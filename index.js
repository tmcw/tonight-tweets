var Twit = require('twit'),
    moment = require('moment'),
    sourceMap = require('./').sourceMap,
    later = require('later'),
    argv = require('minimist')(process.argv.slice(2)),
    AWS = require('aws-sdk'),
    http = require('http');

var T = new Twit({
    consumer_key: process.env.DCTN_TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.DCTN_TWITTER_CONSUMER_SECRET,
    access_token: process.env.DCTN_TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.DCTN_TWITTER_ACCESS_TOKEN_SECRET
});

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
});

var bucketConfig = { params: { Bucket: 'dctn' } },
    s3bucket = new AWS.S3(bucketConfig);

function todayStamp() {
    return moment().format('YYYY-MM-DD') + '.json';
}

function run() {
    s3bucket.getObject({
        Key: todayStamp()
    }, function(err, data) {
        if (err) return;
        try {
            var parsed = JSON.parse(data.Body);
        } catch(e) {
            console.error(e);
        }
        if (!parsed.length) return;
        var titles = parsed.map(function(show) {
            var formatted = '';
            if (show.times && show.times.length) {
              var firstTime = show.times[0];
              var t = moment(firstTime.stamp).zone(0);
              formatted = (t.minutes() ? t.format('h:mm') : t.format('h')) + ' ';
            }
            var twit = sourceMap[show.venue_id].properties.twitter;
            if (twit) {
                twit = ' @' + twit;
            } else {
                twit = ' /' + sourceMap[show.venue_id].properties.shortname;
            }
            return formatted + show.title + twit;
        }).join(', ');
        tweet('TNGHT: ' + titles);
    });
}

function tweet(msg) {
    T.post('statuses/update', { status: msg }, function(err, data, response) {
        if (err) return console.error(err);
        console.log('tweeted');
    });
}

if (argv.now) {
    run();
} else {
    var s = later.parse.recur().on('18:00:00').time();
    later.setInterval(run, s);
}

var server = http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('tonight-tweets worker.');
});

server.listen(process.env.PORT || 3000);

'use strict';

var Assert = require('assert');

var Async = require('async');
var express = require('express');
var Wreck = require('wreck');
var Trooba = require('trooba');

var MAX = 1000000000;
var LIMIT = 200;
var PIPE_LENGTH = 20;

/*
* The test uses express as a backend and only differs with pipeline handlers
*/

describe('express vs trooba', function () {
    var counter = 0;
    var port;

    runOnce();
    runOnce();
    runOnce();
    runOnce();
    runOnce();
    runOnce();

    function runOnce() {
        describe.only('trooba', function () {
            var svr;

            before(function (next) {
                var pipe = Trooba
                .use(function expressBackend(pipe) {
                    pipe.set('service:test', function createService(pipe) {
                        var app = express();
                        app.use(function (req, res) {
                            pipe.create().request(req, function (err, response) {
                                res.status(response.statusCode).end(response.body);
                            });
                        });

                        return app;
                    });
                });

                for (var i = 0; i < PIPE_LENGTH; i++) {
                    pipe.use(function (pipe) {
                        pipe.on('request', function (req, next) {
                            req.$order = req.$order || [];
                            req.$order.push(i);
                            next();
                        });
                    });
                }

                pipe.use(function tr(pipe) {
                    pipe.on('request', function (req, next) {
                        pipe.respond({
                            statusCode: 200,
                            body: 'ok-' + req.$order.length
                        });
                    });
                });

                var app = pipe.build('service:test');
                svr = app.listen(function () {
                    port = svr.address().port;
                    next();
                });
            });

            it('warmup', function (next) {
                Wreck.get('http://localhost:'+port+'/path', function (err, res, payload) {
                    Assert.ok(!err);
                    Assert.equal('ok-' + PIPE_LENGTH, payload.toString());
                    next();
                });
            });

            it('perf test', function (next) {
                counter = 0;
                runTest(next);
            });

        });

        describe.only('express', function () {
            var app;
            var svr;

            beforeEach(function (next) {
                global.gc();
                global.gc();
                global.gc();
                global.gc();
                setTimeout(next, 1000);
            });

            before(function (next) {
                app = express();
                for (var i = 0; i < PIPE_LENGTH; i++) {
                    app.use(function (req, res, next) {
                        req.$order = req.$order || [];
                        req.$order.push(i);
                        next();
                    });
                }
                app.get('/path', function (req, res) {
                    counter++;
                    res.status(200).end('ok-' + req.$order.length);
                });
                svr = app.listen(function () {
                    port = svr.address().port;
                    next();
                });
            });

            after(function (next) {
                svr.close(next);
            });

            it('warmup', function (next) {
                Wreck.get('http://localhost:'+port+'/path', function (err, res, payload) {
                    Assert.ok(!err);
                    Assert.equal('ok-' + PIPE_LENGTH, payload.toString());
                    next();
                });
            });

            it('perf test', function (next) {
                counter = 0;
                runTest(next);
            });
        });



    }

    function runTest(callback) {
        Async.timesLimit(LIMIT, MAX, function (n, next) {
            Wreck.get('http://localhost:'+port+'/path', function (err, res, payload) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('ok-' + PIPE_LENGTH, payload.toString());
                next();
            });
        }, function validate() {
            Assert.ok(MAX, counter);
            callback();
        });
    }

});

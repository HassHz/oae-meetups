/*!
 * Copyright 2014 Apereo Foundation (AF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

var http = require('http');
var xml2js = require('xml2js');

var executeBBBCall = exports.executeBBBCall = function (url, callback) {
    var parseString = xml2js.parseString;

    http.request(url, function(res) {
        res.setEncoding('utf8');
        var completeResponse = '';
        res.on('data', function (chunk) {
          completeResponse += chunk;
        });
        res.on('end', function() {
          parseString(completeResponse, {trim: true, explicitArray: false}, function (err, result) {
              if(err) {
                  return callback(err);
              } else {
                  return callback(null, result['response']);
              }
          });
	      });
    }).on('error', function(err){
        log().info('problem with request: ' + err);
        return callback(err);
    }).end();
};

var executeBBBCall = exports.executeBBBCallExtended = function (fullURL, responseType, method, data, contentType, callback) {
    var parseString = xml2js.parseString;

    var url = require("url");
    var urlParts = url.parse(fullURL, true);

    var options = {};
    options.hostname = urlParts.hostname;
    options.path = urlParts.path;
    if ( urlParts.port ) {
        options.port = urlParts.port;
    } else {
        options.port = '80';
    }
    if (method && method === 'post') {
        options.method = 'POST';
        var headers = {};
        if( contentType ) {
            headers['Content-Type'] = contentType; // Regulaly 'application/x-www-form-urlencoded';
        } else {
            headers['Content-Type'] = 'text/xml';
        }
        if ( data ) {
            headers['Content-Length'] = Buffer.byteLength(data);
        }
        options.headers = headers;
    } else {
        options.method = 'GET';
    }

    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        var completeResponse = '';
        res.on('data', function (chunk) {
            completeResponse += chunk;
        });
        res.on('end', function() {
            if ( responseType === 'raw' ) {
                return callback(null, completeResponse);
            } else {
                parseString(completeResponse, {trim: true, explicitArray: false}, function (err, result) {
                    if(err) {
                        return callback(err);
                    } else {
                        if ('response' in result) {
                            return callback(null, result['response']);
                        } else {
                            return callback(null, result);
                        }
                    }
                });
            }
	      });
    }).on('error', function(err){
        log().info('problem with request: ' + err);
        return callback(err);
    });

    if ( method && method === 'post' && data ) {
        req.write(data);
    }
    req.end();
};
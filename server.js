'use strict';

var fs = require('fs');
var path = require('path');
var Promise = require('promise');
var mkdirp = Promise.denodeify(require('mkdirp'), 1);
var jade = require('jade');
var less = require('less-fixed');
var browserifyRaw = require('browserify');
// reveal
// codemirror

var readFile = Promise.denodeify(fs.readFile, 2);
var writeFile = Promise.denodeify(fs.writeFile, 3);


var CodeMirror = require('highlight-codemirror');

CodeMirror.loadMode('javascript');

jade.filters.javascript = function (src) {
  return '<pre class="cm-s-default CodeMirror"><code>' + CodeMirror.highlight(src, {name: 'javascript'}) + '</code></pre>'
}

function browserify(file, opts) {
  return new Promise(function (resolve, reject) {
      browserifyRaw({entries: [file]}).bundle({
      debug: opts.debug
    }, function (err, src) {
      if (err) return reject(err);
      else resolve(src);
    });
  });
}

function compile() {
  var presentations = fs.readdirSync(__dirname + '/presentations')
  .map(function (presentation) {
    var source = path.join(__dirname, 'presentations', presentation);
    var dest = path.join(__dirname, 'output', presentation.replace(/\.jade$/, ''),
                         'index.html');
    var dir = mkdirp(path.dirname(dest));
    var html = readFile(source).then(function (res) {
      return jade.render(res.toString(), {filename: source, basedir: __dirname});
    });
    return Promise.all(dir, html).then(function (res) {
      return writeFile(dest, res[1]);
    });
  });
  var css = less.toDisc(__dirname + '/index.less', __dirname + '/output/index.css');
  var js = browserify(__dirname + '/index.js', {debug: false}).then(function (res) {
    return writeFile(__dirname + '/output/index.js', res);
  });
  return Promise.all(presentations, css, js);
}

var compiled = null;
function checkCompiled() {
  if (compiled) return compiled;
  compiled = compile();
  compiled.done(function () {
    setTimeout(function () {
      compiled = null;
    }, 500);
  }, function () {
    compiled = null;
  });
  return compiled;
}


var http = require('http');
var ecstatic = require('ecstatic');
var serve = ecstatic({root: __dirname + '/output'});
http.createServer(function (req, res) {
  checkCompiled().done(function () {
    serve(req, res);
  }, function (err) {
    console.error(err.stack || err.message || err);
    res.statusCode = 500;
    res.end((err.stack || err.message || err) + '');
  });
}).listen(3000);
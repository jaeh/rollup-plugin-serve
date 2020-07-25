import { existsSync, readFile } from 'fs';
import { createServer } from 'https';
import { createServer as createServer$1 } from 'http';
import { resolve } from 'path';
import mime from 'mime';
import opener from 'opener';

var server;

/**
 * Serve your rolled up bundle like webpack-dev-server
 * @param {ServeOptions|string|string[]} options
 */
var serve = function (options) {
  if ( options === void 0 ) options = { contentBase: '' };

  if (Array.isArray(options) || typeof options === 'string') {
    options = { contentBase: options };
  }
  options.contentBase = Array.isArray(options.contentBase) ? options.contentBase : [options.contentBase || ''];
  options.port = options.port || 10001;
  options.headers = options.headers || {};
  options.https = options.https || false;
  options.openPage = options.openPage || '';
  mime.default_type = 'text/plain';

  var requestListener = function (request, response) {
    // Remove querystring
    var urlPath = decodeURI(request.url.split('?')[0]);

    Object.keys(options.headers).forEach(function (key) {
      response.setHeader(key, options.headers[key]);
    });

    var supportsCompression = request.headers['accept-encoding'].includes('gzip');
    console.log('comp', supportsCompression);

    readFileFromContentBase(options.contentBase, urlPath, supportsCompression, function (error, content, filePath) {
      if (!error) {
        return found(response, filePath, content)
      }
      if (error.code !== 'ENOENT') {
        response.writeHead(500);
        response.end('500 Internal Server Error' +
          '\n\n' + filePath +
          '\n\n' + Object.values(error).join('\n') +
          '\n\n(rollup-plugin-serve)', 'utf-8');
        return
      }
      if (options.historyApiFallback) {
        var fallbackPath = typeof options.historyApiFallback === 'string' ? options.historyApiFallback : '/index.html';
        readFileFromContentBase(options.contentBase, fallbackPath, supportsCompression, function (error, content, filePath) {
          if (error) {
            notFound(response, filePath);
          } else {
            found(response, filePath, content);
          }
        });
      } else {
        notFound(response, filePath);
      }
    });
  };

  // release previous server instance if rollup is reloading configuration in watch mode
  if (server) {
    server.close();
  } else {
    closeServerOnTermination();
  }

  // If HTTPS options are available, create an HTTPS server
  if (options.https) {
    server = createServer(options.https, requestListener).listen(options.port, options.host);
  } else {
    server = createServer$1(requestListener).listen(options.port, options.host);
  }

  // assemble url for error and info messages
  var protocol = (options.https ? 'https' : 'http');
  var hostname = options.host || 'localhost';
  var url = protocol + '://' + hostname + ':' + options.port;

  server.on('error', function (e) {
    if (e.code === 'EADDRINUSE') {
      console.error(url + ' is in use, either stop the other server or use a different port.');
      process.exit();
    } else {
      throw e
    }
  });

  var running = options.verbose === false;

  return {
    name: 'serve',
    generateBundle: function generateBundle() {
      if (!running) {
        running = true;

        // Log which url to visit
        options.contentBase.forEach(function (base) {
          console.log(green(url) + ' -> ' + resolve(base));
        });

        // Open browser
        if (options.open) {
          if (/https?:\/\/.+/.test(options.openPage)) {
            opener(options.openPage);
          } else {
            opener(url + options.openPage);
          }
        }
      }
    }
  }
};

var readFileFromContentBase = function (contentBase, urlPath, supportsCompression, callback) {
  var filePath = resolve(contentBase[0] || '.', '.' + urlPath);

  // Load index.html in directories
  if (urlPath.endsWith('/')) {
    filePath = resolve(filePath, 'index.html');
  }

  if (supportsCompression && existsSync(filePath + '.gz')) {
    filePath += '.gz';
  }

  readFile(filePath, function (error, content) {
    if (error && contentBase.length > 1) {
      // Try to read from next contentBase
      readFileFromContentBase(contentBase.slice(1), urlPath, supportsCompression, callback);
    } else {
      // We know enough
      callback(error, content, filePath);
    }
  });
};

var notFound = function (response, filePath) {
  response.writeHead(404);
  response.end('404 Not Found' +
    '\n\n' + filePath +
    '\n\n(rollup-plugin-serve)', 'utf-8');
};

var found = function (response, filePath, content) {
  var origPath = filePath.endsWith('.gz') ? filePath.slice(0, -3) : filePath;
  var headers = {
    'Content-Type': mime.getType(origPath)
  };

  if (filePath !== origPath) {
    headers['Content-Encoding'] = 'gzip';
  }

  response.writeHead(200, headers);
  response.end(content, 'utf-8');
};

var green = function (text) { return '\u001b[1m\u001b[32m' + text + '\u001b[39m\u001b[22m'; };

var closeServerOnTermination = function () {
  var terminationSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP'];
  terminationSignals.forEach(function (signal) {
    process.on(signal, function () {
      if (server) {
        server.close();
        process.exit();
      }
    });
  });
};

/**
 * @typedef {Object} ServeOptions
 * @property {boolean} [open=false] Launch in browser (default: `false`)
 * @property {string} [openPage=''] Page to navigate to when opening the browser. Will not do anything if `open` is `false`. Remember to start with a slash e.g. `'/different/page'`
 * @property {boolean} [verbose=true] Show server address in console (default: `true`)
 * @property {string|string[]} [contentBase=''] Folder(s) to serve files from
 * @property {string|boolean} [historyApiFallback] Path to fallback page. Set to `true` to return index.html (200) instead of error page (404)
 * @property {string} [host='localhost'] Server host (default: `'localhost'`)
 * @property {number} [port=10001] Server port (default: `10001`)
 * @property {ServeOptionsHttps} [https=false] By default server will be served over HTTP (https: `false`). It can optionally be served over HTTPS
 * @property {{[header:string]: string}} [headers] Set headers
 */

/**
 * @typedef {Object} ServeOptionsHttps
 * @property {string|Buffer|Buffer[]|Object[]} key
 * @property {string|Buffer|Array<string|Buffer>} cert
 * @property {string|Buffer|Array<string|Buffer>} ca
 * @see https.ServerOptions
 */

export { serve };

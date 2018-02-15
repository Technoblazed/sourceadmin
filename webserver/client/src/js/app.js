/*
 *  CSS Imports
 */

import 'semantic-ui-css/components/button.css';
import 'semantic-ui-css/components/container.css';
import 'semantic-ui-css/components/grid.css';
import 'semantic-ui-css/components/icon.css';
import 'semantic-ui-css/components/input.css';
import 'semantic-ui-css/components/reset.css';
import 'semantic-ui-css/components/site.css';

import '../css/app.css';

/*
 *  Image Imports
 */

import '../images/favicon.ico';

/*
 *  Javascript
 */

/* global BASEURL_DATA */
const urlData = BASEURL_DATA;

// eslint-disable-next-line no-undef
const ws = new WebSocket((urlData.protocol === 'http:' ? 'ws' : 'wss') + '://' + urlData.host);

ws.onopen = function() {
  console.log('websocket is connected ...');

  ws.send('connected');
};

ws.onmessage = function(message) {
  console.log(message);
};

// ADD AUTO RECONNECT

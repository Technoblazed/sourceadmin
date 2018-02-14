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

const ws = new WebSocket(`ws://${BASE_URL}`);

ws.onopen = function() {
  console.log('websocket is connected ...');

  ws.send('connected');
};

ws.onmessage = function(message) {
  console.log(message);
};

// ADD AUTO RECONNECT

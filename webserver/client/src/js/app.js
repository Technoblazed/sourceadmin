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

let wsConnected = false;
let wsConnecting = false;
let wsConnectAttempts = 1;
let wsReconnecting = false;
let ws = false;

const websocket = module.exports = {
  connect: () => {
    if (wsConnected || wsConnecting) {
      return;
    }

    wsConnecting = true;

    const urlData = BASEURL_DATA; /* global BASEURL_DATA */
    ws = new WebSocket((urlData.protocol === 'http:' ? 'ws' : 'wss') + '://' + urlData.host);

    ws.onopen = () => {
      wsConnected = true;
      wsConnectAttempts = 1;

      if (wsReconnecting) {
        wsReconnecting = false;
      }

      ws.send('connected');
    };

    ws.onmessage = (message) => {
      console.log(message);
    };

    ws.onerror = () => {
      wsConnectAttempts++;
      wsConnected = false;

      if (wsConnecting) {
        wsReconnecting = false;
      }

      websocket.reconnect();
    };

    ws.onclose = () => {
      if (!wsConnected || !ws) {
        return;
      }

      wsConnectAttempts++;

      websocket.reconnect();
    };

    window.onbeforeunload = (event) => {
      wsConnected = false;

      ws.close();
    };
  },
  disconnect: () => {
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        console.log(e);
      }
    }

    wsConnected = false;
    wsConnecting = false;
    ws = false;
  },
  reconnect: () => {
    websocket.disconnect();

    if (wsConnecting) {
      return;
    }

    setTimeout(() => {
      wsReconnecting = true;

      websocket.connect();
    }, Math.random() * (Math.pow(2, wsConnectAttempts) - 1) * 10 * 1000);
  }
};

websocket.connect();

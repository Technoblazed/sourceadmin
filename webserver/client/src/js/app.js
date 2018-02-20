/*
 *  CSS Imports
 */

import 'semantic-ui-css/components/button.css';
import 'semantic-ui-css/components/card.css';
import 'semantic-ui-css/components/container.css';
import 'semantic-ui-css/components/divider.css';
import 'semantic-ui-css/components/dropdown.css';
import 'semantic-ui-css/components/grid.css';
import 'semantic-ui-css/components/header.css';
import 'semantic-ui-css/components/icon.css';
import 'semantic-ui-css/components/input.css';
import 'semantic-ui-css/components/list.css';
import 'semantic-ui-css/components/menu.css';
import 'semantic-ui-css/components/reset.css';
import 'semantic-ui-css/components/segment.css';
import 'semantic-ui-css/components/site.css';

import '../css/app.css';

/*
 *  Image Imports
 */

import '../images/favicon.ico';

/*
 *  Javascript
 */

import $ from 'jquery';
import _forEach from 'lodash/forEach';

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
    };

    ws.onmessage = (message) => {
      let data;

      try {
        data = JSON.parse(message.data);
      } catch (e) {
        console.log(e);

        return;
      }

      switch (data.type) {
        case 'adminUpdate': {
          const usersLoaded = [];

          $('tr[id^=admin]').remove();

          _forEach(data.adminList, (admin) => {
            if (!usersLoaded.includes(admin.data.steamId)) {
              usersLoaded.push(admin.data.steamId);

              $(`<tr id="admin#${admin.data.steamId}"><td><h4 class="ui image header"><img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/${admin.data.steamAvatar}" class="ui mini rounded image"><div class="content">${admin.data.steamUsername}<div class="sub header"><a href="https://steamcommunity.com/profiles/${admin.data.steamId}" target="_blank">${admin.data.steamId}</a></div></div></h4></td ></tr>`).appendTo('#adminList tbody');
            }
          });

          return;
        }
      }
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

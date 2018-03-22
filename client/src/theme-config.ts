import Vue from 'vue';
import Vuetify from 'vuetify';
import VuetifyTheme from 'vuetify';
import * as utils from './util/utils';

Vue.use(require('vue-moment'));

import 'vuetify/dist/vuetify.css';
import 'mdi/css/materialdesignicons.min.css';
import Datetime from 'vue-datetime';
import 'vue-datetime/dist/vue-datetime.css';

if (utils.parseBoolean(localStorage.getItem('darkTheme')) === null) {
    localStorage.setItem('darkTheme', 'true');
}

let darkColors: VuetifyTheme = {
    primary: '#00695C',
    secondary: '#424242',
    accent: '#616161',
    error: '#b71c1c',
    themeText: '#f5f5f5',
    textOnColor: '#f5f5f5',
    back: '#303030',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    highlight: '#616161'
  };
  
  let lightColors: VuetifyTheme = {
    primary: '#0D5494',
    secondary: '#ebebeb',
    accent: '#d6d6d6',
    error: '#b71c1c',
    themeText: '#303030',
    textOnColor: '#f5f5f5',
    back: '#d6d6d6',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    highlight: '#BDBDBD'
  };

  if (utils.parseBoolean(localStorage.getItem('darkTheme')) === false) {
    Vue.use(Vuetify, { theme: lightColors });
  } else {
    Vue.use(Vuetify, { theme: darkColors }); 
  }

  export function getTheme(darkTheme) {
    if (darkTheme === true) {
      localStorage.setItem('darkTheme', 'true');
      return darkColors;
    } else {
        localStorage.setItem('darkTheme', 'false');
      return lightColors;
    }
  }
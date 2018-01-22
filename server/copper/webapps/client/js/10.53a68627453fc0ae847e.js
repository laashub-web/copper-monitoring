webpackJsonp([10],{'./node_modules/css-loader/index.js?{"minimize":true,"sourceMap":true,"importLoaders":2}!./node_modules/postcss-loader/lib/index.js?{"sourceMap":true,"plugins":[null]}!./node_modules/sass-loader/lib/loader.js?{"outputStyle":"expanded","sourceMap":true,"sourceMapContents":true}!./src/components/dashboard/sidebar/config/config.scss':function(e,t,n){t=e.exports=n("./node_modules/css-loader/lib/css-base.js")(!0),t.push([e.i,".engine-connection-config form{padding-top:8px;width:100%}","",{version:3,sources:["/home/vg/projects/vue-typescript/src/components/dashboard/sidebar/config/config.scss"],names:[],mappings:"AAAA,+BAEQ,gBAAgB,AAChB,UAAW,CACd",file:"config.scss",sourcesContent:[".engine-connection-config {\n    form {\n        padding-top: 8px;\n        width: 100%;\n    }\n\n}"],sourceRoot:""}])},"./src/components/dashboard/sidebar/config/config.html":function(e,t){e.exports='<v-card color="teal darken-3" class="white--text engine-connection-config">\n    <v-card-title primary-title>\n        <div class="headline"> \n            <v-icon> mdi-settings</v-icon> \n            <span>Connection config</span>\n        </div>\n        <v-form v-model="valid" ref="form" lazy-validation>\n            <v-text-field\n                label="Host"\n                v-model="host"\n                :rules="hostRules"\n                required\n            ></v-text-field>\n            <v-text-field\n                label="port"\n                v-model="port"\n                :rules="portRules"\n                required\n            ></v-text-field>\n            <v-text-field\n                label="Update period(seconds)"\n                v-model="updatePeriod"\n                :rules="numberRules"\n            ></v-text-field>\n            <v-text-field\n                label="For period(minutes)"\n                v-model="fetchPeriod"\n                :rules="numberRules"\n            ></v-text-field>\n        \n            <v-btn\n                @click="submit"\n                :disabled="!valid"\n            >\n                submit\n            </v-btn>\n        </v-form>\n    </v-card-title>\n</v-card>'},"./src/components/dashboard/sidebar/config/config.scss":function(e,t,n){var o=n('./node_modules/css-loader/index.js?{"minimize":true,"sourceMap":true,"importLoaders":2}!./node_modules/postcss-loader/lib/index.js?{"sourceMap":true,"plugins":[null]}!./node_modules/sass-loader/lib/loader.js?{"outputStyle":"expanded","sourceMap":true,"sourceMapContents":true}!./src/components/dashboard/sidebar/config/config.scss');"string"==typeof o&&(o=[[e.i,o,""]]);var s={hmr:!0};s.transform=void 0;n("./node_modules/style-loader/lib/addStyles.js")(o,s);o.locals&&(e.exports=o.locals)},"./src/components/dashboard/sidebar/config/config.ts":function(e,t,n){"use strict";n.d(t,"a",function(){return d});var o=n("./node_modules/vue-property-decorator/lib/vue-property-decorator.umd.js"),s=(n.n(o),n("./src/components/dashboard/sidebar/config/config.scss")),r=(n.n(s),n("./src/models/connectionSettings.ts")),i=this&&this.__extends||function(){var e=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n])};return function(t,n){function o(){this.constructor=t}e(t,n),t.prototype=null===n?Object.create(n):(o.prototype=n.prototype,new o)}}(),c=this&&this.__decorate||function(e,t,n,o){var s,r=arguments.length,i=r<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,n):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)i=Reflect.decorate(e,t,n,o);else for(var c=e.length-1;c>=0;c--)(s=e[c])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i},d=function(e){function t(){var t=null!==e&&e.apply(this,arguments)||this;return t.host="",t.port=1099,t.fetchPeriod=5,t.updatePeriod=10,t.valid=!0,t.hostRules=[function(e){return!!e||"Host is required"}],t.portRules=[function(e){return!!e||"Port is required"}],t.numberRules=[function(e){return/^\d+$/.test(e)||"Should be number"}],t}return i(t,e),Object.defineProperty(t.prototype,"connectionSettings",{get:function(){return this.$store.state.connectionSettings},enumerable:!0,configurable:!0}),t.prototype.mounted=function(){this.host=this.connectionSettings.host,this.port=this.connectionSettings.port,this.fetchPeriod=this.connectionSettings.fetchPeriod,this.updatePeriod=this.connectionSettings.updatePeriod},t.prototype.submit=function(){console.log("submiting"),this.$emit("updateTarget",new r.a(this.host,this.port,this.fetchPeriod,this.updatePeriod))},t=c([Object(o.Component)({template:n("./src/components/dashboard/sidebar/config/config.html")})],t)}(o.Vue)},"./src/components/dashboard/sidebar/config/index.ts":function(e,t,n){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var o=n("./src/components/dashboard/sidebar/config/config.ts");n.d(t,"ConfigComponent",function(){return o.a})}});
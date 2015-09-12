/*
 Copyright (C) 2015  Mark Baird

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var http = require('http');

module.exports = function(pb) {

  //pb dependencies
  var util              = pb.util;
  var UrlService        = pb.UrlService;
  var BaseObjectService = pb.BaseObjectService;

  function CacheService(context) {
    if (!util.isObject(context)) {
      context = {};
    }

    CacheService.super_.call(this, context);
  }
  util.inherits(CacheService, BaseObjectService);


  /**
   * The name the service
   * @private
   * @static
   * @readonly
   * @property SERVICE_NAME
   * @type {String}
   */
  var SERVICE_NAME = 'CacheService';


  /**
   * Provides a mechanism to inspect an object just after it is persited
   * @static
   * @method afterSave
   * @param {Object} context
   * @param {Boolean} isCreate Indicates if this is a creation operation
   * @param {Boolean} isUpdate Indicates if the this is an update operation
   * @param {Object} context.data The object that is to be validated before persistence
   * @param {Array} context.validationErrors The array that can be added to in
   * order to supply your own validation errors
   * @param {CacheService} context.service An instance of the service that triggered
   * the event that called this handler
   * @param {Function} cb A callback that takes a single parameter: an error if occurred
   */
  CacheService.afterSave = function(context, cb) {
    if (context.validationErrors.length == 0 && context.data.draft == 0) {
      var url = UrlService.urlJoin(context.hostname, context.data.object_type, context.data.url);
      var cachedUrl = url;

      if (context.isCreate) {
        pb.log.info("New [" + context.data.object_type + "] created at URL: [" + url + "]. Clearing cache for homepage.");
        cachedUrl = context.hostname;
      }
      else {
        pb.log.info("Clearing cache for [" + context.data.object_type + "] at URL: [" + url + "].");
      }

      CacheService.clearUrl(context, cachedUrl);
    }

    cb(null);
  };

  CacheService.clearUrl = function(context, url) {
    var pluginService = new pb.PluginService({site: context.site});

    pluginService.getSettingsKV('cloudflare', function(err, settings) {
      if (util.isError(err)) {
        pb.error.log(err);
        return;
      }
      else if (!settings || !settings.cloudflare_api_key || settings.cloudflare_api_key.length === 0
          || !settings.cloudflare_email_address || settings.cloudflare_email_address.length === 0) {
        pb.log.warn('CloudFlare: Settings have not been initialized!');
        return;
      }

      var apiKey  = settings.cloudflare_api_key;
      var email   = settings.cloudflare_email_address;

      var options = {
        host: 'https://www.cloudflare.com/api_json.html',
        port: 80,
        path: '?tkn=' + apiKey + '&a=zone_file_purge&email=' + email + '&z=example.com&url=' + url
      };

      http.get(options, function (res) {
        pb.log.info("CloudFlare API Response [" + res.statusCode + "]");
      }).on('error', function (e) {
        pb.log.error("CloudFlare API returned error [" + e.message + "]");
      });
    });
  };

  /**
   * Provides a mechansim to inspect an object just after it has been deleted
   * @static
   * @method afterDelete
   * @param {Object} context
   * @param {Object} context.data The object that is to be deleted
   * @param {CacheService} context.service An instance of the service that triggered
   * the event that called this handler
   * @param {Function} cb A callback that takes a single parameter: an error if occurred
   */
  CacheService.afterDelete = function(context, cb) {
    if (context.data.draft == 0) {
      var url = UrlService.urlJoin(context.hostname, context.data.object_type, context.data.url);

      pb.log.info("Clearing cache for deleted [" + context.data.object_type + "] at URL: [" + url + "].");
      CacheService.clearUrl(context, url);
    }

    cb(null);
  };

  /**
   * This function is called when the service is being setup by the system.  It is
   * responsible for any setup that is needed when first created.  The services
   * are all instantiated at once and are not added to the platform untill all
   * initialization is complete.  Relying on other plugin services in the
   * initialization could result in failure.
   *
   * @static
   * @method init
   * @param {Function} cb A callback that should provide one argument: cb(error) or cb(null)
   * if initialization proceeded successfully.
   */
  CacheService.init = function(cb) {
    pb.log.debug("CacheService: Initialized");
    cb(null, true);
  };

  /**
   * A service interface function designed to allow developers to name the handle
   * to the service object what ever they desire. The function must return a
   * valid string and must not conflict with the names of other services for the
   * plugin that the service is associated with.
   *
   * @static
   * @method getName
   * @return {String} The service name
   */
  CacheService.getName = function() {
    return SERVICE_NAME;
  };

  //Event Registries - Sets the handlers as the call backs when events are triggered for the given collection
  BaseObjectService.on('article.' + BaseObjectService.AFTER_SAVE, CacheService.afterSave);
  BaseObjectService.on('article.' + BaseObjectService.AFTER_DELETE, CacheService.afterDelete);
  BaseObjectService.on('page.' + BaseObjectService.AFTER_SAVE, CacheService.afterSave);
  BaseObjectService.on('page.' + BaseObjectService.AFTER_DELETE, CacheService.afterDelete);

  //exports
  return CacheService;
};

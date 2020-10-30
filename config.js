var _ = require('lodash')
var dotenv = require('dotenv')

dotenv.config()

var defaultConfig = {
  INTERCOM_ACCESS_TOKEN: '',
  HELPSCOUT_API_KEY: '',
  HELPSCOUT_SITE_ID: ''
}

var keys = _.keys(defaultConfig)
var config = _.cloneDeep(defaultConfig)

module.exports = _.assign(config, _.pick(process.env, keys))

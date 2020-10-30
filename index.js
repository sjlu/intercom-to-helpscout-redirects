var Promise = require('bluebird')
var _ = require('lodash')
var URI = require('urijs')
var config = require('./config')
var request = Promise.promisify(require('request'))

var getIntercomArticles = async function (page = 0) {
  return request({
    method: 'GET',
    url: 'https://api.intercom.io/articles',
    headers: {
      authorization: `Bearer ${config.INTERCOM_ACCESS_TOKEN}`
    },
    qs: {
      page: page
    },
    json: true
  })
}

var listIntercomArticles = async function () {
  var articles = []

  var currentPage = 0
  var totalPages = 1
  while (currentPage < totalPages) {
    var resp = await getIntercomArticles(currentPage)
    var body = resp.body
    _.each(body.data, function (article) {
      articles.push({
        title: article.title,
        url: article.url
      })
    })

    totalPages = _.get(body, 'pages.total_pages')
    currentPage++
  }

  return articles
}

var helpscoutRequest = function (req) {
  _.assign(req, {
    baseUrl: 'https://docsapi.helpscout.net/v1/',
    auth: {
      user: config.HELPSCOUT_API_KEY,
      pass: 'X'
    },
    json: true
  })

  return request(req)
}

var getHelpscoutCollections = async function (page = 0) {
  return helpscoutRequest({
    method: 'GET',
    url: `/collections`,
    qs: {
      page: page
    }
  })
}

var listHelpscoutCollections = async function () {
  var collections = []

  var currentPage = 0
  var totalPages = 1
  while (currentPage < totalPages) {
    var resp = await getHelpscoutCollections(currentPage)
    var body = resp.body
    var items = _.get(body, 'collections.items')
    _.each(items, function (item) {
      collections.push({
        id: item.id,
        url: item.publicUrl
      })
    })

    totalPages = _.get(body, 'collections.pages')
    currentPage++
  }

  return collections
}

var getHelpscoutDocs = async function (collectionId, page = 0) {
  return helpscoutRequest({
    method: 'GET',
    url: `/collections/${collectionId}/articles`,
    qs: {
      page: page
    }
  })
}

var listHelpscoutDocs = async function (collectionId) {
  var collections = await listHelpscoutCollections()
  var docs = []

  for (collection of collections) {
    var currentPage = 0
    var totalPages = 1
    while (currentPage < totalPages) {
      var resp = await getHelpscoutDocs(collection.id, currentPage)
      var body = resp.body
      var items = _.get(body, 'articles.items')
      _.each(items, function (item) {
        docs.push({
          url: item.publicUrl,
          title: item.name
        })
      })

      totalPages = _.get(body, 'articles.pages')
      currentPage++
    }
  }

  return docs
}

var createRedirect = function (fromUrl, toUrl) {
  var from = new URI(fromUrl)
  var to = new URI(toUrl)

  console.log(`${from.path()} → ${to.path()}`)

  return helpscoutRequest({
    method: 'POST',
    url: '/redirects',
    body: {
      siteId: config.HELPSCOUT_SITE_ID,
      urlMapping: from.path(),
      redirect: toUrl
    }
  })
  .then(function (resp) {
    console.log(resp.statusCode)
  })
}

return Promise
  .bind({})
  .then(function () {
    return Promise.all([
      listIntercomArticles(),
      listHelpscoutDocs()
    ])
  })
  .spread(function (articles, docs) {
    var intercomToHelpscout = {}
    _.each(articles, function (article) {
      var helpscoutDoc = _.find(docs, { title: article.title })
      intercomToHelpscout[article.url] = _.get(helpscoutDoc, 'url')
    })

    return _.map(intercomToHelpscout, function (to, from) {
      return {
        to,
        from
      }
    })
  })
  .mapSeries(function (mapping) {
    if (!mapping.to) {
      return mapping
    }

    return createRedirect(mapping.from, mapping.to)
  })
  .then(function (mappings) {
    console.log(_.filter(mappings))
  })

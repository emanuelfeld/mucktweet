'use strict'

let touchEvent = 'ontouchstart' in window ? 'touchstart' : 'click'

window.addEventListener('hashchange', clickHashTab, false)

function clickHashTab () {
  let oldMenuItem = document.querySelector('.menu-item[selected="true"]')
  oldMenuItem.setAttribute('selected', 'false')
  let oldHash = oldMenuItem.id.split('-')[1]
  let oldSection = document.querySelector('section.' + oldHash)
  oldSection.setAttribute('selected', 'false')

  let newHash
  if (!window.location.hash) {
    newHash = 'about'
  } else {
    newHash = window.location.hash.split('#')[1]
  }
  let newMenuItem = document.querySelector('.menu-item.' + newHash)
  newMenuItem.setAttribute('selected', 'true')
  let newSection = document.querySelector('section.' + newHash)
  newSection.setAttribute('selected', 'true')
  sendLocationWithHash()
}

window.addEventListener('load', function () {
  clickHashTab()
})

function sendLocationWithHash () {
  if (window.ga && ga.create) {
    ga('send', 'pageview', { 'page': location.pathname + location.hash})
  }
}

(function (i, s, o, g, r, a, m) {
  i['GoogleAnalyticsObject'] = r; i[r] = i[r] || function () {
    (i[r].q = i[r].q || []).push(arguments)
  }, i[r].l = 1 * new Date(); a = s.createElement(o),
m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga')

ga('create', 'UA-61502361-1', 'auto')

var trackOutboundLink = function (url) {
  if (window.ga && ga.create) {
    ga('send', 'event', 'outbound', 'click', url, {
      'transport': 'beacon',
      'hitCallback': function () {
        window.open(url)
      }
    })
  } else {
    window.open(url)
  }
}

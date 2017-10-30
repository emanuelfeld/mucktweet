(function () {
  'use strict'

  if (window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  document.addEventListener('click', function (evt) {
    if (evt.target.id === 'about') {
      window.open('https://emanuelfeld.github.io/mucktweet')
    } else {
      window.browser.runtime.sendMessage({
        'type': 'popup',
        'content': evt.target.id
      }, function (res) {
        window.open(res.content)
      })
    }
  })
})()

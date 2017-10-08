(function () {
  'use strict'

  let touchEvent = 'ontouchstart' in window ? 'touchstart' : 'click'

  window.addEventListener('hashchange', clickHashTab, false)

  function clickHashTab () {
    let oldMenuItem = document.querySelector('[selected="true"]')
    oldMenuItem.setAttribute('selected', 'false')
    let oldHash = oldMenuItem.id.split('-')[1]
    let oldSection = document.querySelector('section.' + oldHash)
    oldSection.style.display = 'none'

    let newHash = window.location.hash.split('#')[1]
    let newMenuItem = document.querySelector('.menu-item.' + newHash)
    newMenuItem.setAttribute('selected', 'true')
    let newSection = document.querySelector('section.' + newHash)
    newSection.style.display = 'block'
  }

  window.addEventListener('load', function () {
    if (window.location.hash) {
      clickHashTab()
    }    
  })
})()

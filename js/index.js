(function () {
  'use strict'

  window.addEventListener('hashchange', clickHashTab, false)

  function clickHashTab () {
    const sectionId = window.location.hash.split('#')[1]
    document.querySelector('.menu-item.' + sectionId).click()
  }

  window.onload = function () {
    if (window.location.hash) {
      clickHashTab()
    }
  }

  document.onclick = function (evt) {
    let element = evt.srcElement
    if (element.classList.contains('menu-item') && element.hasAttribute('selected') === false) {
      let prevSelectedMenuItem = document.querySelector('.menu-item[selected]')
      prevSelectedMenuItem.removeAttribute('selected')
      let prevSectionClass = prevSelectedMenuItem.id.split('-')[1]
      document.querySelector('section.' + prevSectionClass).style.display = 'none'

      // select and show new section, set hash
      element.setAttribute('selected', '')
      let sectionClass = element.id.split('-')[1]
      document.querySelector('section.' + sectionClass).style.display = 'block'
      window.location.hash = '#' + sectionClass
    }
  }
})()

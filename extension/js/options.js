(function () {
  'use strict'

  if (window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  function archivingOn (opt) {
    if (opt === true) {
      document.getElementById('archive-option-true').setAttribute('selected', 'true')
      document.getElementById('archive-option-false').setAttribute('selected', 'false')
    } else if (opt === false) {
      document.getElementById('archive-option-true').setAttribute('selected', 'false')
      document.getElementById('archive-option-false').setAttribute('selected', 'true')
    }
  }

  function hasUnsavedChanges (status) {
    let save = document.getElementById('save')
    if (status === true) {
      save.textContent = 'SAVE CHANGES?'
      save.setAttribute('saved', 'false')
    } else if (status === false) {
      save.textContent = 'OPTIONS SAVED'
      save.setAttribute('saved', 'true')
    }
  }

  function saveOptions () {
    let archiving = document.getElementById('archive-option-true').getAttribute('selected')
    window.browser.storage.local.set({
      'archiving': archiving
    }, function () {
      let status = document.getElementById('status')
      hasUnsavedChanges(false)
    })
  }

  function restoreOptions () {
    hasUnsavedChanges(false)
    window.browser.storage.local.get({
      'archiving': 'true'
    }, function (res) {
      if (res.archiving === 'true') {
        archivingOn(true)
      } else {
        archivingOn(false)
      }
    })
  }

  window.addEventListener('click', function (evt) {
    let el = evt.target
    if (el.classList.contains('menu-item') && el.getAttribute('selected') === 'false') {
      restoreOptions()
    }
  })
  window.addEventListener('load', restoreOptions)
  document.getElementById('save').addEventListener('click', saveOptions)
  document.getElementById('archive-option-true').addEventListener('click', function () {
    archivingOn(true)
    hasUnsavedChanges(true)
  })
  document.getElementById('archive-option-false').addEventListener('click', function () {
    archivingOn(false)
    hasUnsavedChanges(true)
  })
})()

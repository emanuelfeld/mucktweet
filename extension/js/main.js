(function () {
  'use strict'

  const DEBUG = false

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let userData = {}
  let tweetData = {}
  let reportData = {}

  let getReportDetails = function () {
    let iframe = document.querySelector('iframe#new-report-flow-frame')
    if (iframe !== null) {
      let inputs = iframe.contentWindow.document.querySelectorAll('input[type="radio"]')

      for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].checked === true) {
          let inputName = inputs[i].name
          let inputValue = inputs[i].value.replace('-', ' ').toLowerCase()
          if (inputName === 'report_type') {
            console.log('reportType', inputValue)
            reportData['reportType'] = inputValue
          } else if (inputName === 'abuse_type') {
            console.log('abuseType', inputValue)
            reportData['abuseType'] = inputValue
          } else if (inputName.indexOf('victim') > -1) {
            console.log('victim', inputValue)
            reportData['victim'] = inputValue
          }
        }
      }
    }
  }

  function getReportData (userId, tweetId) {
    return {
      'userId': userId,
      'tweetId': tweetId,
      'dateSubmitted': Date.now()
    }
  }

  function getUserData (node) {
    console.log('Parsing user data')
    return {
      'id': node.getAttribute('data-user-id'),
      'screenName': node.getAttribute('data-screen-name'),
      'name': node.getAttribute('data-name'),
      'status': 'available',
      'statusHistory': []
    }
  }

  function getTweetData (node) {
    console.log('Parsing tweet data')
    return {
      'id': node.getAttribute('data-tweet-id'),
      'userId': node.getAttribute('data-user-id'),
      'permalinkPath': node.getAttribute('data-permalink-path'),
      'postDate': parseInt(node.querySelector('._timestamp').getAttribute('data-time-ms')),
      'status': 'available',
      'statusHistory': []
    }
  }

  function beganReport (node, reportType) {
    let reportActive = document.getElementById('report-dialog') !== null &&
      document.getElementById('report-dialog')
        .style.display !== 'none' &&
      document.getElementById('report-dialog')
        .classList.contains('report-' + reportType)

    if (reportActive &&
        document.getElementById('report-dialog')
          .contains(node) &&
        document.getElementById('report-dialog')
          .querySelector('.modal-content')
          .contains(node) === false) {
      return false
    }
    return reportActive
  }

  function submittedReport (node) {
    if ((document.getElementById('report-dialog') &&
         document.getElementById('report-dialog').style.display === 'block') === false) {
      return false
    }

    return node.classList.contains('add-text') ||
           node.classList.contains('tweet-number') ||
           node.classList.contains('new-report-flow-done-button')
  }

  function hasReportData () {
    return Object.keys(userData).length > 0 ||
           Object.keys(tweetData).length > 0
  }

  window.addEventListener('load', function (evt) {
    window.browser.runtime.sendMessage({'type': 'update'}, function (res) {
      console.log('Sent update message', res.content)
    })
  })

  document.addEventListener('click', function (evt) {
    console.log('Clicked', evt.target)
    getReportDetails()

    if ((DEBUG && hasReportData()) || submittedReport(evt.target)) {
      let userId = userData['id']
      let tweetId = tweetData['id']

      reportData = Object.assign({}, reportData, getReportData(userId, tweetId))
      userData['dateLastUpdated'] = reportData['dateSubmitted']
      tweetData['dateLastUpdated'] = reportData['dateSubmitted']

      console.log('Submitting user report:', JSON.stringify(userData))
      console.log('Submitting tweet report:', JSON.stringify(tweetData))
      window.browser.runtime.sendMessage({
        'type': 'report',
        'content': {
          'reportData': reportData,
          'userData': userData,
          'tweetData': tweetData
        }
      }, function (res) {
        userData = {}
        tweetData = {}
        reportData = {}
        window.browser.runtime.sendMessage({'type': 'update'}, function (res) {
          console.log('Sent update message', res.content)
        })
      })
    } else if (beganReport(evt.target, 'user')) {
      let node = document.querySelector('.user-actions')
      if (node) {
        userData = getUserData(node)
        console.log('Beginning user report:', JSON.stringify(userData))
      }
    } else if (beganReport(evt.target, 'tweet')) {
      let node = evt.target.closest('.tweet')
      if (node) {
        userData = getUserData(node)
        console.log('Beginning user report:', JSON.stringify(userData))
        tweetData = getTweetData(node)
        console.log('Beginning tweet report:', JSON.stringify(tweetData))
      }
    }
  })
})()

(function () {
  window.onload = function () {
    console.log('loading popup')

    if (!!window.chrome) {
      window.browser = window.chrome
    } else {
      window.browser = browser
    }

    let browserStorage = window.browser.storage.local
    
    function updatePopup(data, id) {
      let div = document.getElementById(id)
      if (data) {
        div.style.display = 'block'
        let title = div.getElementsByTagName('h2')[0]
        let list = div.getElementsByTagName('ul')[0]
        Object.keys(data).forEach(function (key) {
          let listItem = document.createElement('li')
          listItem.textContent = JSON.stringify(data[key])
          list.append(listItem)
        })
      } else {
        div.style.display = 'none'
      }
    }

    browserStorage.get({
      'taUsersSuspended': '{}', 
      'taUsersDeleted': '{}', 
      'taTweetsDeleted': '{}'
    }, function (res) {
      let taUsersSuspended = JSON.parse(res.taUsersSuspended)
      let taUsersDeleted = JSON.parse(res.taUsersDeleted)
      console.log(res.taTweetsDeleted)
      let taTweetsDeleted = JSON.parse(res.taTweetsDeleted)

      updatePopup(taUsersSuspended, 'user-suspended')
      updatePopup(taUsersDeleted, 'user-deleted')
      updatePopup(taTweetsDeleted, 'tweet-deleted')
    })
  }
})()
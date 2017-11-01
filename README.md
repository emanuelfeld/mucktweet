# mucktweet

A browser extension for Twitter abuse report muckrakers. MuckTweet monitors the status of users and tweets you have reported, notifying you when there has been a change.

Details of report and report users and tweets is stored using the IndexedDB API.

[Download for Chrome](https://chrome.google.com/webstore/detail/mucktweet/djckflgmaallfimdmmgalachmkaledhk)

## Report and Resolution Timeline

Action: User reports another user or tweet for:
* Report Type 1: Annoying (uninteresting)
* Report Type 2: Spam
* Report Type 3: Abuse
  * Abuse Type 1: Disrespectful
  * Abuse Type 2: Includes private information
    * Victim 1: Me or someone I represent
    * Victim 2: Someone else
  * Abuse Type 3: Includes targeted harassment
    * Victim 1: Me
    * Victim 2: Someone else
  * Abuse Type 4: Directs hate against a race, religion, gender, or orientation
    * Victim 1: Me
    * Victim 2: Someone else
    * Victim 3: A group of people
  * Abuse Type 5: Threatening violence or physical harm
    * Victim 1: Me
    * Victim 2: Someone else
  * Abuse Type 6: This person might be considering suicide or self-harm
  
Response 1: No update

Response 2: Investigation finds account in violation of the Twitter Rules
* Action 1: Tweet and user remain (user possibly temporarily locked out)
* Action 2: Tweet deleted, but account remains
* Action 3: Interstitial screen on user account notifying of possible irregular behavior
* Action 4: User deletes account
* Action 5: User account suspended
* Action 6: User account suspended, but later unsuspended

Response 3: ?

## Screenshots

![screenshot-recently](https://user-images.githubusercontent.com/4269640/31522018-d2ba3d46-af79-11e7-850c-df3f5b05b76c.png)
![screenshot-statistics](https://user-images.githubusercontent.com/4269640/31522019-d2c7bdc2-af79-11e7-8362-1964075ad590.png)
![screenshot-data-download](https://user-images.githubusercontent.com/4269640/31522013-d13ef8bc-af79-11e7-9e38-f3c8a2b0e02d.png)

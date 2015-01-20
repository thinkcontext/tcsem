Combo scraper / semantic tagger mashup-er in Meteor for use w/ [thinkContext](http://thinkcontext.org).

The goal is to associate linked data entities with scraped text.  Runs text through the Alchemy NLP API for initial entity resolution.  Then provides a basic interface to manually select from candidates or add entities aided by Freebase Suggest.  Exposes the results as a json dump.

### Prerequisites

* Meteor
* Alchemy API key
* Google Freebase API key 
* Change.org API key 

### Installing

1) Clone this repo
2) Add your keys to settings.json.  Assign your Google Freebase API key to "public", it will be visible through the front end!  (Don't blame me, this is how Freebase Suggest works)
3) cd tcsem ; meteor run --settings ../settings.json

### Future

Ditch Alchemy and use FOX which has supervised learning capabilities.


fetchFeed = function(fid,furl,cb){
	var FeedParser = Npm.require('feedparser')
	, request = Npm.require('request');
	
	var req = request(furl),
	feedparser = new FeedParser();
	
	req.on('error', function (error) {
	    // handle any request errors
	});
	req.on('response', function (res) {
	    var stream = this;
	    
	    if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
	    
	    stream.pipe(feedparser);
	});
	
	feedparser.on('error', function(error) {
	    // always handle errors
	});
	feedparser.on('readable', function() {
	    // This is where the action is!
	    var stream = this
	    , meta = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance
	    , item;
	    var iid;
	    while (item = stream.read()) {
		iid = item.link.replace(/\W/g,'');
		item._id = iid
		item.feed_id = fid;
		cb(iid,item);
	    }
	});
}
    

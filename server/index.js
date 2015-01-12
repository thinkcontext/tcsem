// Quick 'n dirty semantic tagging interface 

Feeds = new Meteor.Collection("feeds");
Meteor.publish("feeds",function(){
    return Feeds.find();
});
FeedEntries = new Meteor.Collection("feedentries");
Petitions = new Meteor.Collection("petitions");

//Calais = Npm.require('calais').Calais;
//dbps = Npm.require('dbpedia-spotlight');
// dbps.annotate(input,function(output){ console.log(output); });
cho_key = Meteor.settings.cho_key;
alchemy_key = Meteor.settings.alchemy_key;
refresh_interval = 4 * 3600 * 1000; // 4 hours
feed_info = {
    democracynow: { link: 'http://www.democracynow.org/democracynow.rss' },
    corpwatch: { link:'http://www.corpwatch.org/rssfeed.php' },
    consumerist: { link:'http://consumerist.com/feed/' },
    eff: { link: 'https://www.eff.org/rss/updates.xml'}
};


// propublica: {link: "http://feeds.propublica.org/propublica/main"}
// http://thinkprogress.org/feed/
// http://thinkprogress.org/election/issue/feed/
// http://thinkprogress.org/sports/issue/feed/
// http://thinkprogress.org/culture/issue/feed/
// http://thinkprogress.org/world/issue/feed/
// http://thinkprogress.org/lgbt/issue/feed/
// http://thinkprogress.org/justice/issue/feed/
// http://thinkprogress.org/health/issue/feed/
// http://thinkprogress.org/economy/issue/feed/
// http://thinkprogress.org/climate/issue/feed/
// http://fair.org/feed/
// http://www.racialicious.com/feed/
// http://feministing.com/feed/
// http://grist.org/feed/
// http://blog.greenamerica.org/feed/
// https://futureofmusic.org/feeds/futureblog
// http://www.foodandwaterwatch.org/blogs/feed/

// add the first user to the FeedEntries group, subsequent ones will have to be added manually
Accounts.onCreateUser(
    function(options,user){
	if(Meteor.users.find().count() == 0){
	    if(!user.groups)
		user.groups = [];
	    user.groups.push('Items');	    
	}
	return user;
    });

Meteor.startup(function () {
    
    // collections = {
    // 	feeds: Feeds,
    // 	feedentries: FeedEntries
    // }
    
    // Feed.collections(collections);
    
    if(! cho_key || ! alchemy_key){
	console.log('missing key',Meteor.settings);
	exit();
    }

    var feUpsert = Meteor.bindEnvironment(
	function(id,doc){
	    console.log('feInsert');
	    FeedEntries.upsert({_id: id},doc,function(a,b){console.log('feInsert',a,b)});
	});
    
    for(var i in feed_info){ 
	console.log('feed',i);
	Feeds.upsert({_id:i},{_id: i, link: feed_info[i].link});

	fetchFeed(i,feed_info[i].link,feUpsert);
	
	// Feed.createRssFeed({_id: i, 
	// 		    link:feed_info[i].link,
	// 		    refresh_interval: refresh_interval
	// 		   });
    }

    var newFeedEntries = FeedEntries.find();
    newFeedEntries.observe({
    	added: feedEntryObserve,
    	updated: feedEntryObserve
    });

//    Feed.read();
    Meteor.call('getCelPetitions')
    getChoPetitions();

    // var c = Petitions.find().count();
    // if(c == 0)
    // 	getCelPetitions();
    // else if(c > 1000){
    // 	del = Petitions.find({},{skip:1000,sort:{created_at:-1}});
    // 	del.forEach(function(doc,i,c){ Petitions.remove(doc._id) });
    // }
});

function stripW(txt){
    return txt.replace(/\W/g,'');
}

function feedEntryObserve(doc){
    try{
	var iid = stripW(doc._id);
	if(!Items.findOne({_id: iid})){
	    var t = cheerio.load(doc.description)('*').html();//text().replace(/\n/g,"<br>");
	    doc.entities = entityEnhance(doc.title + ". " + t);
	    console.log('feedEntryObserve',doc._id,iid);
	    FeedEntries.update(doc._id,doc);	    
	    doc.description = t;
	    doc._id = iid;
	    Items.upsert(iid,doc);
	}
    } catch(e){ console.log('feedEntryObserve',e); }
}

// expose the petitions
HTTP.methods({
    currentItems: function(){
	return JSON.stringify(
	    Items.find({accepted:true}).fetch()
	);
    }
});

Meteor.methods({
    getCelPetitions: function(){
//	if(Meteor.user())
	    getCelPetitions();
    }
});
 
entityEnhance = function(text){
    console.log('entityEnhance',text.substring(0,30));
    var enhancerUrl = "http://access.alchemyapi.com/calls/text/TextGetRankedNamedEntities"
    var r, ret = [], entities, e,wiki;
    try {
	r = HTTP.post(enhancerUrl
		      ,{params: { text : text
				  , apikey: alchemy_key
				  , outputMode : 'json'
				}
			, headers : {Accept: "application/json"
				     ,"Content-type": 'text/plain'
				    }
		       });
    } catch(e){ return false; }
    entities = r.data.entities;
    for(var i=0;i < entities.length;i++){
	e = entities[i];
	wiki = null;
	if((e['type'] == 'Organization' || e['type'] == 'Company' || e['type'] == 'Person') && e['relevance'] >= '0.3' && e['disambiguated'] && ( e['disambiguated']['website'] || e['disambiguated']['dbpedia']) && e['disambiguated']['name']){
	    if(wiki = e['disambiguated']['dbpedia'])
		wiki = wiki.replace('http://dbpedia.org/resource/','https://en.wikipedia.org/wiki/');

	    ret.push({name: e['disambiguated']['name']
		      ,website:  e['disambiguated']['website']
		      ,wikipedia: wiki
		      ,relevance: e['relevance']});
	}
    }
    return ret;
}

function getCelPetition(url,feed_id,dt){
    var r, title, who, what, ret;
    try{
	r = HTTP.get(url);
	$ = cheerio.load(r.content);
	title = $('title').text().replace(/ \| \w+$/,'');
	who = $('h2.who').first();
	who = who.children().first()[0].next;
	who = who.data.trim();
	what = $('pre.what').text().trim();	
	ret = { title:title
		, who:who
		, description:what
		, link:url
		, publish:false
		, date: dt
		, feed_id: feed_id
	      };
    } catch (e){ console.log(e);}
    return ret;
}

function getCelPetitions(){
    //console.log('getMorePetitions');
    var cel_urls = { coworker: {link: "https://www.coworker.org/categories"},
		    colorofchange: {link: "http://iam.colorofchange.org/categories"}};
    var petition_urls, purl,r,base_url,cel_url;
    try {
	for(var j in cel_urls){
	    cel_url = cel_urls[j].link
	    base_url =  _.initial(cel_url.split('/')).join('/');
	    r = HTTP.get(cel_url);
	    $ = cheerio.load(r.content);
	    petition_urls = $("a[href*='/petitions/']");
	    
	    console.log('petitions',petition_urls.length);
	    var dt = new Date;
	    for(var i=0; i < petition_urls.length; i++){
		dt = new Date(dt - 1);
    		purl = base_url + petition_urls[i].attribs.href;
		if(!Items.findOne({link: purl}) && 
		   (petition = getCelPetition(purl,j,dt))){
  		    entities = entityEnhance(petition.title + ". " + petition.description + ". " + petition.who);
    		    if(entities)
    			petition.entities = entities;
		    else
			petition.entities = [];
    		    Items.upsert({link: petition.link},petition);
		}
	    }
	}
    } catch(e){ console.log(e); }
}

function getChoPetitions(){
    var ch_url = 'https://www.change.org/petitions?view=recommended&hash=featured&hash_prefix=&first_request=true&list_type=default';
    var pids = [];
    try {
        var r = HTTP.get(ch_url
                         ,{headers: {"X-Requested-With": "XMLHttpRequest"
                                     ,"Accept": "application/json, text/javascript, */*; q=0.01"}});
        if(r.data && r.data.html){
            var html = r.data.html;
            var di = /data-id="([0-9]+)"/g;
            var m;
            while(m=di.exec(html)){
                pids.push(m[1]);
            }
        }
    } catch(e){ 
	console.log(e);
	return false;
    }
    console.log('pids',pids);
    if(!(pids && pids.join && pids.length > 0))
	return false
    var apiUrl = 'http://api.change.org/v1/petitions';
    var r,petitions;
    try {
	var r = HTTP.get(apiUrl
			 , {params: {api_key: cho_key, petition_ids: pids.join(',')}
			    , headers: {"X-Requested-With": "XMLHttpRequest"
					,"Accept": "application/json, text/javascript, */*; q=0.01"}});
    } catch(e) { 
	console.log(e);
	return false; 
    }
    
    if(r.data && r.data.petitions && r.data.petitions.length > 0){
	petitions = r.data.petitions;
	var petition,item = null, entities,iid;
	for(var i in petitions){
	    petition = petitions[i];
	    iid = stripW(petition.url);
	    if(! Items.findOne({_id: iid})){
		item = {
		    _id: iid,
		    title: petition.title,
		    description: petition.overview,
		    link: petition.url,
		    date: petition.created_at,
		    end_at: petition.end_at,
		    feed_id: 'cho',
		    entities: []
		};
		entities = entityEnhance(petition.title + " " + petition.overview + " " + petition.targets.map(function(x){ return x.name }).join(" , "));
		if(entities && entities.length > 0)
		    item.entities = entities;
		Items.insert(item);
	    }
	}
    }
}

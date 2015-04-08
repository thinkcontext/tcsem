// Quick 'n dirty semantic tagging interface 

Feeds = new Meteor.Collection("feeds");
Meteor.publish("feeds",function(){
    return Feeds.find();
});
FeedEntries = new Meteor.Collection("feedentries");
Petitions = new Meteor.Collection("petitions");

//dbps = Npm.require('dbpedia-spotlight');
//dbps.annotate(input,function(output){ console.log(output); });
cho_key = Meteor.settings.cho_key;
alchemy_key = Meteor.settings.alchemy_key;
refresh_interval = 4 * 3600 * 1000; // 4 hours
feed_info = {
//    corpwatch: { link:'http://www.corpwatch.org/rssfeed.php' },
    sumofus: {link:'http://sumofus.org/feed/'},
    consumerist: {link:'http://consumerist.com/feed/'},
    mediate:{link:'http://www.mediaite.com/feed'},
	racialicious:{link:'http://www.racialicious.com/feed'},
	feministing:{link:'http://feministing.com/feed/'},
	grist:{link:'http://feeds.grist.org/rss/gristfeed'}
};

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
    if(! cho_key || ! alchemy_key){
	console.log('missing key',Meteor.settings);
	exit();
    }

    var feUpsert = Meteor.bindEnvironment(
	function(id,doc){
	    FeedEntries.upsert({_id: id},doc);
	});
    
    for(var i in feed_info){ 
		Feeds.upsert({_id:i},{_id: i, link: feed_info[i].link});
		fetchFeed(i,feed_info[i].link,feUpsert);
    }

    var newFeedEntries = FeedEntries.find();
    newFeedEntries.observe({
    	added: feedEntryObserve,
    	updated: feedEntryObserve
    });

    Meteor.call('refreshAll');
    Meteor.setTimeout(function(){
	Meteor.call('refreshAll');
    }, 4 * 3600 * 1000);    
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
    refreshAll: function(){
//	if(Meteor.user())
	console.log('refreshAll');
	getCelPetitions();
	getEffPetitions();
	getChoPetitions();
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
    console.log('getCelPetitions');
    var cel_urls = { coworker: {link: "https://www.coworker.org/categories"} //,
		     // colorofchange: {link: "http://iam.colorofchange.org/categories"}
		   };
    var petition_urls, purl,r,base_url,cel_url;
    try {
	for(var j in cel_urls){
	    cel_url = cel_urls[j].link
	    base_url =  _.initial(cel_url.split('/')).join('/');
	    r = HTTP.get(cel_url);
	    $ = cheerio.load(r.content);
	    petition_urls = $("a[href*='/petitions/']");
	    
	    //console.log('petitions',petition_urls.length);
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
    console.log('getChoPetitions');
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
function getEffPetitions(){
    console.log('getEffPetitions');
    try{
	var pets, url = 'https://act.eff.org/action', dt = new Date;
	r = HTTP.get(url);
	$ = cheerio.load(r.content);
	pets = $('div.text').map(function(){ 
	    return {title: this.find('h3').text(), description: this.find('p').text(), url: this.find('a').attr('href')} });
	pets.forEach(function(x){
	    var ret, iid = stripW(x.url);
	    if(! Items.findOne({_id: iid})){
		if(x.url.match(/^\/action/)){
		    ret = { _id: iid
			    , title: x.title
			    , description: x.description
			    , link: 'https://act.eff.org' + x.url
			    , publish:false
			    , date: dt
			    , feed_id: 'effact'
			    , entities: []
			  };
		    entities = entityEnhance(ret.title + ". " + ret.description);
		    if(entities && entities.length > 0)
			ret.entities = entities;
		    Items.insert(ret);		
		}
	    }
	});
    } catch(e){ 
	console.log('getEffPetitions',e);
    }
}

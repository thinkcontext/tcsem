Meteor.subscribe('feeds');
Feeds = new Meteor.Collection("feeds");
Template.feedSelect.helpers({
    fhelp: function(){
	return _.union([{feed_id: 'All feeds'},{feed_id:'cho'},{feed_id:'coworker'},{feed_id:'colorofchange'}],Feeds.find().fetch().map(function(x){return {feed_id:x._id}}));
    }
});
Template.feedSelect.events({
    'change': function(event,template){
	console.log('change',event.target.value);
	if(event.target.value == 'All feeds')
	    Pages.set({filters: {}});
	else
	    Pages.set({filters: { feed_id : event.target.value }});
    }
});

Template.item.events({
    'fb-select': function(event,template,sug){
	// map the Freebase pick to Wikipedia and website
    	if(sug.mid){
    	    HTTP.get('https://www.googleapis.com/freebase/v1/topic' + sug.mid
    		     ,{params: {filter:'/common',limit:0}}
		     ,function(e,r){
			 var i, tew, wik;
			 if(r.data && r.data.property){
			     if(r.data.property['/common/topic/official_website'])
				 event.target.parentElement.parentElement.children[1].children[0].value = r.data.property['/common/topic/official_website'].values[0].text;
			     
			     if(r.data.property['/common/topic/topic_equivalent_webpage']){
				 tew = r.data.property['/common/topic/topic_equivalent_webpage'].values;
				 for(i = 0; i < tew.length; i++){
				     wik = tew[i].value;
				     if(wik.match(/en\.wikipedia\.org/) && ! wik.match(/curid=/)){
					 event.target.parentElement.parentElement.children[2].children[0].value = wik;
					 break;
				     }
				 }
			     }
			 }
		     });
	}
    }
    ,"click .new-entity-accept" : function(event,template){
	var name = $("#" + this._id + " .new-entity-cell input.fbsuggest-name").val();
	var website = $("#" + this._id + " .new-entity-cell input.fbsuggest-website").val();
	var wiki = $("#" + this._id + " .new-entity-cell input.fbsuggest-wiki").val();
	if(name && (website || wiki)){
	    this.entities.push({name: name
				, relevance: 1
				, website: website
				, wikipedia: wiki
				, accepted: true
			       });
	    Items.update(this._id,{$set:{entities:this.entities}});
	    $(".new-entity-cell input.fbsuggest-name").val('');
	    $(".new-entity-cell input.fbsuggest-website").val('');
	    $(".new-entity-cell input.fbsuggest-wiki").val('');		
	}
    }
    ,"click button.item-accept": function(event,template){
	var entities = [];
	if(this.accepted)
	    this.accepted = false;
	else{
	    this.accepted = true;
	    // remove unaccepted entities
	    for(var i = 0; i < this.entities.length; i++){
		if(this.entities[i].accepted)
		    entities.push(this.entities[i]);
	    }
	    this.entities = entities;
	}
	Items.update(this._id,{$set:{entities:this.entities, accepted: this.accepted}});
    }
});

Template.item.helpers({
    getItemStatusMsg: function(){
	if(this.accepted)
	    return "Remove";
	else 
	    return "Accept";	    
    }
    , getItemStatusColor: function(){
	if(this.accepted)
	    return "#99FF66";
	else 
	    return "#FF9966";
    }	
    , freebase_key: function(){
	return Meteor.settings.public;
    }
});
Template.items.events({
    "click #getMoreItems": function(){ Meteor.call("getMoreItems"); }
});

Template.items.helpers({
    items : function(){
	return Items.find();
    }
});

Template.entity.events({
    "click .entity-accept": function(event,template){
	var pid, pet, ents;
	pid = template.firstNode.attributes[2].value;
	if(pid){
	    pet = Items.findOne(pid);
	    if(this.accepted)
		this.accepted = false;
	    else
		this.accepted = true;
	    ents = pet.entities;
	    for(var i = 0; i < ents.length; i++){
		if(ents[i].name == this.name && ents[i].relevance == this.relevance){
		    ents[i] = this;
		    pet.entities = ents;
		    Items.update({_id:pid},{$set:{entities:pet.entities}});
		    return true;
		}
	    }
	}
    }
});
Template.entity.helpers({
    id : function(){
	return this['@id'];
    }
    , getEntityStatusColor: function(){
	if(this.accepted)
	    return "#99FF66";
	else 
	    return "#FF9966";
    }
    , getEntityStatusMsg: function(){
	if(this.accepted)
	    return "Remove";
	else 
	    return "Accept";	    
    }
});

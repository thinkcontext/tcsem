Items = new Meteor.Collection("items");
// allow all permissions if they are in the "Items" group, read only otherwise
Items.allow({
    insert: function(userId, petition){
	var u = Meteor.users.findOne(userId);
	return (u && u.groups && u.groups.indexOf('Items') >= 0);
    }
    , update: function(userId, petition){
	var u = Meteor.users.findOne(userId);
	return (u && u.groups && u.groups.indexOf('Items') >= 0);
    }
    , remove: function(userId, petition){
	var u = Meteor.users.findOne(userId);
	return (u && u.groups && u.groups.indexOf('Items') >= 0);
    }
});

// Partial dataset for client
Pages = new Meteor.Pagination(Items,
			      { itemTemplate: 'item'
			        , perPage: 10
				, sort : { date : -1 }
				, availableSettings: { filters: true }
			      });


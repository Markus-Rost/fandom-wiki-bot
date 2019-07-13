require('dotenv').config();
const util = require('util');
util.inspect.defaultOptions = {compact:false,breakLength:Infinity};

const Discord = require('discord.js');
const DBL = require('dblapi.js');
var request = require('request');
var htmlparser = require('htmlparser2');

var client = new Discord.Client( {
	messageCacheLifetime: 600,
	messageSweepInterval: 6000,
	disableEveryone: true,
	disabledEvents: ["TYPING_START"]
} );
const dbl = new DBL(process.env.dbltoken);

var i18n = require('./i18n/allLangs.json');
Object.keys(i18n.allLangs[1]).forEach( lang => i18n[lang] = require('./i18n/' + lang + '.json') );

var pause = {};
var stop = false;
var isDebug = ( process.argv[2] === 'debug' );
const access = {'PRIVATE-TOKEN': process.env.access};
const defaultPermissions = new Discord.Permissions(268954688).toArray();
const timeoptions = {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'UTC',
	timeZoneName: 'short'
}


var ready = {
	settings: true
}

const defaultSettings = {
	"default": {
		"lang": "en",
		"wiki": "https://community.fandom.com/"
	}
}
var settings = defaultSettings;

function getSettings() {
	ready.settings = true;
	request( {
		uri: process.env.read + process.env.file + process.env.raw,
		headers: access,
		json: true
	}, function( error, response, body ) {
		if ( error || !response || response.statusCode !== 200 || !body || body.message || body.error ) {
			console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the settings: ' + ( error || body && ( body.message || body.error ) ) );
			ready.settings = false;
		}
		else {
			console.log( '- Settings successfully loaded.' );
			if ( body.default ) settings = JSON.parse(JSON.stringify(body));
			else if ( settings === defaultSettings ) settings = JSON.parse(JSON.stringify(defaultSettings));
		}
		setStatus();
	} );
}

function setStatus(hardreset) {
	if ( settings === defaultSettings ) client.user.setStatus('invisible').catch(log_error);
	else if ( hardreset === true ) client.user.setStatus('invisible').then(setStatus, log_error);
	else {
		client.user.setStatus('online').catch(log_error);
		client.user.setActivity( process.env.prefix + ' help' ).catch(log_error);
	}
}

client.on( 'ready', () => {
	console.log( '- Successfully logged in as ' + client.user.username + '!' );
	getSettings();
	
	if ( !isDebug ) client.setInterval( () => {
		console.log( '- Current server count: ' + client.guilds.size );
		dbl.postStats(client.guilds.size).catch( () => {} );
		request.post( {
			uri: 'https://discord.bots.gg/api/v1/bots/' + client.user.id + '/stats',
			headers: {Authorization: process.env.dbggtoken},
			body: {guildCount: client.guilds.size},
			json: true
		}, () => {} );
	}, 10800000 ).unref();
} );
	
	
var cmdmap = {
	help: cmd_help,
	test: cmd_test,
	pause: cmd_pause,
	invite: cmd_invite,
	say: cmd_multiline,
	delete: cmd_multiline,
	poll: cmd_multiline,
	voice: cmd_voice,
	settings: cmd_settings,
	info: cmd_info
}

var multilinecmdmap = {
	say: cmd_say,
	delete: cmd_delete,
	poll: cmd_umfrage
}

var ownercmdmap = {
	stop: cmd_stop,
	pause: cmd_pause,
	eval: cmd_eval,
	get: cmd_get
}

var pausecmdmap = {
	help: cmd_help,
	test: cmd_test,
	pause: cmd_pause,
	say: cmd_multiline,
	delete: cmd_multiline,
	settings: cmd_settings
}

/**
 * Show or change the settings
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_settings(lang, msg, args, line) {
	if ( msg.isAdmin() ) {
		if ( msg.guild.id in settings ) {
			var text = lang.settings.current.replaceSave( '%1$s', '- `' + process.env.prefix + ' settings lang`' ).replaceSave( '%2$s', settings[msg.guild.id].wiki + ' - `' + process.env.prefix + ' settings wiki`' ) + ' - `' + process.env.prefix + ' settings channel`\n';
			if ( settings[msg.guild.id].channels ) {
				Object.keys(settings[msg.guild.id].channels).forEach( function(channel) {
					text += '<#' + channel + '>: <' + settings[msg.guild.id].channels[channel] + '>\n';
				} );
			} else text += lang.settings.nochannels;
		} else {
			var text = lang.settings.missing.replaceSave( '%1$s', '`' + process.env.prefix + ' settings lang`' ).replaceSave( '%2$s', '`' + process.env.prefix + ' settings wiki`' );
		}
		if ( args.length ) {
			if ( args[0] ) args[0] = args[0].toLowerCase();
			args[1] = args.slice(1).join(' ').toLowerCase().trim().replace( /^<(.*)>$/, '$1' );
			if ( args[1] && ( args[0] === 'wiki' || args[0] === 'channel' ) ) {
				var wikinew = '';
				var regex = args[1].match( /^(?:https:\/\/)?([a-z\d-]{1,50}\.(?:fandom\.com|wikia\.org)(?:(?!\/wiki\/)\/[a-z-]{1,8})?)(?:\/|$)/ );
				if ( regex !== null ) wikinew = 'https://' + regex[1] + '/';
				else if ( /^(?:[a-z-]{1,8}\.)?[a-z\d-]{1,50}$/.test(args[1]) ) {
					if ( args[1].includes( '.' ) ) wikinew = 'https://' + args[1].split('.')[1] + '.fandom.com/' + args[1].split('.')[0] + '/';
					else wikinew = 'https://' + args[1] + '.fandom.com/';
				}
			}
			var langs = '\n' + lang.settings.langhelp.replaceSave( '%s', process.env.prefix + ' settings lang' ) + ' `' + Object.values(i18n.allLangs[1]).join(', ') + '`';
			var wikis = '\n' + lang.settings.wikihelp.replaceSave( '%s', process.env.prefix + ' settings wiki' );
			var channels = '\n' + lang.settings.wikihelp.replaceSave( '%s', process.env.prefix + ' settings channel' );
			var nolangs = lang.settings.langinvalid + langs;
			var nowikis = lang.settings.wikiinvalid + wikis;
			var nochannels = lang.settings.wikiinvalid + channels;
			if ( msg.guild.id in settings ) {
				var current	= args[0] + ( line === 'changed' ? line : '' );
				if ( args[0] === 'lang' ) {
					if ( args[1] ) {
						if ( args[1] in i18n.allLangs[0] ) edit_settings(lang, msg, 'lang', i18n.allLangs[0][args[1]]);
						else msg.replyMsg( nolangs, {}, true );
					} else msg.replyMsg( lang.settings[current] + langs, {}, true );
				} else if ( args[0] === 'wiki' ) {
					if ( args[1] ) {
						if ( wikinew ) edit_settings(lang, msg, 'wiki', wikinew);
						else msg.replyMsg( nowikis, {}, true );
					} else msg.replyMsg( lang.settings[current] + ' ' + settings[msg.guild.id].wiki + wikis, {}, true );
				} else if ( args[0] === 'channel' ) {
					if ( args[1] ) {
						if ( wikinew ) edit_settings(lang, msg, 'channel', wikinew);
						else msg.replyMsg( nochannels, {}, true );
					} else if ( settings[msg.guild.id].channels && msg.channel.id in settings[msg.guild.id].channels ) {
						msg.replyMsg( lang.settings[current] + ' ' + settings[msg.guild.id].channels[msg.channel.id] + channels, {}, true );
					} else msg.replyMsg( lang.settings[current] + ' ' + settings[msg.guild.id].wiki + channels, {}, true );
				} else msg.replyMsg( text, {}, true );
			} else {
				if ( args[0] === 'lang' ) {
					if ( args[1] ) {
						if ( args[1] in i18n.allLangs[0] ) edit_settings(lang, msg, 'lang', i18n.allLangs[0][args[1]]);
						else msg.replyMsg( nolangs, {}, true );
					} else msg.replyMsg( lang.settings.lang + langs, {}, true );
				} else if ( args[0] === 'wiki' || args[0] === 'channel' ) {
					if ( args[1] ) {
						if ( wikinew ) edit_settings(lang, msg, 'wiki', wikinew);
						else msg.replyMsg( nowikis, {}, true );
					} else msg.replyMsg( lang.settings.wikimissing + wikis, {}, true );
				} else msg.replyMsg( text, {split:true}, true );
			}
		} else msg.replyMsg( text, {split:true}, true );
	} else {
		msg.reactEmoji('❌');
	}
}

/**
 * Edit the settings
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [key] The name of the setting to change
 * @param {String|String[]} [value] The new value of the setting
 */
function edit_settings(lang, msg, key, value) {
	msg.reactEmoji('⏳', true).then( function( reaction ) {
		if ( settings === defaultSettings ) {
			console.log( '- Error while getting current settings.' );
			msg.replyMsg( lang.settings.save_failed, {}, true );
			if ( reaction ) reaction.removeEmoji();
		}
		else {
			var temp_settings = JSON.parse(JSON.stringify(settings));
			var save = false;
			if ( !( msg.guild.id in temp_settings ) ) {
				temp_settings[msg.guild.id] = Object.assign({}, settings.default);
				save = true;
			}
			if ( key === 'channel' ) {
				if ( !temp_settings[msg.guild.id].channels ) temp_settings[msg.guild.id].channels = {};
				if ( temp_settings[msg.guild.id].channels[msg.channel.id] !== value ) {
					temp_settings[msg.guild.id].channels[msg.channel.id] = value;
					save = true;
				}
			} else if ( temp_settings[msg.guild.id][key] !== value ) {
				temp_settings[msg.guild.id][key] = value;
				save = true;
			}
			Object.keys(temp_settings).forEach( function(guild) {
				if ( !client.guilds.has(guild) && guild !== 'default' ) {
					delete temp_settings[guild];
					save = true;
				} else {
					var channels = temp_settings[guild].channels;
					if ( channels ) {
						Object.keys(channels).forEach( function(channel) {
							if ( channels[channel] === temp_settings[guild].wiki || !client.guilds.get(guild).channels.has(channel) ) {
								delete channels[channel];
								save = true;
							}
						} );
						if ( !Object.keys(channels).length ) {
							delete temp_settings[guild].channels;
							save = true;
						}
					}
				}
			} );
			if ( save ) request.post( {
				uri: process.env.save,
				headers: access,
				body: {
					branch: 'master',
					commit_message: client.user.username + ': Settings updated.',
					actions: [
						{
							action: 'update',
							file_path: process.env.file,
							content: JSON.stringify( temp_settings, null, '\t' )
						}
					]
				},
				json: true
			}, function( error, response, body ) {
				if ( error || !response || response.statusCode !== 201 || !body || body.error ) {
					console.log( '- ' + ( response && response.statusCode ) + ': Error while editing the settings: ' + ( error || body && ( body.message || body.error ) ) );
					msg.replyMsg( lang.settings.save_failed, {}, true );
				}
				else {
					settings = JSON.parse(JSON.stringify(temp_settings));
					if ( key === 'lang' ) lang = i18n[value];
					cmd_settings(lang, msg, [key], 'changed');
					console.log( '- Settings successfully updated.' );
				}
				
				if ( reaction ) reaction.removeEmoji();
			} );
			else {
				cmd_settings(lang, msg, [key], 'changed');
				
				if ( reaction ) reaction.removeEmoji();
			}
		}
	} );
}

/**
 * Show information about the bot
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_info(lang, msg, args, line) {
	if ( args.join('') ) cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	else {
		msg.sendChannel( lang.disclaimer.replaceSave( '%s', ( msg.channel.type === 'text' && msg.guild.members.get(process.env.owner) || '*MarkusRost*' ) ) + '\n<https://www.patreon.com/WikiBot>' );
		cmd_helpserver(lang, msg);
		cmd_invite(lang, msg, args, line);
	}
}

/**
 * Send a link to the help server
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 */
function cmd_helpserver(lang, msg) {
	msg.sendChannel( lang.helpserver + '\n' + process.env.invite );
}

/**
 * Send an invite for the bot
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_invite(lang, msg, args, line) {
	if ( args.join('') ) {
		cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	} else {
		client.generateInvite(defaultPermissions).then( invite => msg.sendChannel( lang.invite.bot + '\n<' + invite + '>' ), log_error );
	}
}

/**
 * Show the bot help
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_help(lang, msg, args, line) {
	if ( msg.channel.type === 'text' && pause[msg.guild.id] && ( args.join('') || !msg.isAdmin() ) ) return;
	if ( msg.isAdmin() && !( msg.guild.id in settings ) && settings !== defaultSettings ) {
		cmd_settings(lang, msg, [], line);
		cmd_helpserver(lang, msg);
	}
	var cmds = lang.help.list;
	var cmdintro = '🔹 `' + process.env.prefix + ' ';
	if ( args.join('') ) {
		if ( args.join(' ').isMention(msg.guild) ) cmd_helpserver(lang, msg);
		else if ( args[0].toLowerCase() === 'admin' ) {
			if ( msg.channel.type !== 'text' || msg.isAdmin() ) {
				var cmdlist = lang.help.admin + '\n' + cmds.filter( cmd => cmd.admin && !cmd.hide ).map( cmd => cmdintro + cmd.cmd + '`\n\t' + cmd.desc ).join('\n');
				cmdlist = cmdlist.replaceSave( /@mention/g, '@' + ( msg.channel.type === 'text' ? msg.guild.me.displayName : client.user.username ) );
				msg.sendChannel( cmdlist, {split:true} );
			}
			else {
				msg.replyMsg( lang.help.noadmin );
			}
		}
		else {
			var cmdlist = cmds.filter( cmd => cmd.cmd.split(' ')[0] === args[0].toLowerCase() && !cmd.unsearchable && ( msg.channel.type !== 'text' || !cmd.admin || msg.isAdmin() ) ).map( cmd => cmdintro + cmd.cmd + '`\n\t' + cmd.desc ).join('\n');
			cmdlist = cmdlist.replaceSave( /@mention/g, '@' + ( msg.channel.type === 'text' ? msg.guild.me.displayName : client.user.username ) );
			if ( cmdlist === '' ) msg.reactEmoji('❓');
			else msg.sendChannel( cmdlist, {split:true} );
		}
	}
	else if ( msg.isAdmin() && pause[msg.guild.id] ) {
		var cmdlist = lang.help.pause + '\n' + cmds.filter( cmd => cmd.pause ).map( cmd => cmdintro + cmd.cmd + '`\n\t' + cmd.desc ).join('\n');
		cmdlist = cmdlist.replaceSave( /@mention/g, '@' + ( msg.channel.type === 'text' ? msg.guild.me.displayName : client.user.username ) );
		msg.sendChannel( cmdlist, {split:true}, true );
	}
	else {
		var cmdlist = lang.help.all + '\n' + cmds.filter( cmd => !cmd.hide && !cmd.admin ).map( cmd => cmdintro + cmd.cmd + '`\n\t' + cmd.desc ).join('\n') + '\n\n🔸 ' + lang.help.footer;
		cmdlist = cmdlist.replaceSave( /@mention/g, '@' + ( msg.channel.type === 'text' ? msg.guild.me.displayName : client.user.username ) );
		msg.sendChannel( cmdlist, {split:true} );
	}
}

/**
 * Make the bot talk
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_say(lang, msg, args, line) {
	args = args.toEmojis();
	var text = args.join(' ');
	if ( args[0] === 'alarm' ) text = '🚨 **' + args.slice(1).join(' ') + '** 🚨';
	var imgs = [];
	if ( msg.uploadFiles() ) imgs = msg.attachments.map( function(img) {
		return {attachment:img.url,name:img.filename};
	} );
	if ( msg.isOwner() ) {
		try {
			text = eval( '`' + text + '`' );
		} catch ( error ) {
			log_error(error);
		}
	}
	if ( text || imgs.length ) {
		msg.channel.send( text, {disableEveryone:!msg.member.hasPermission(['MENTION_EVERYONE']),files:imgs} ).then( () => msg.deleteMsg(), error => {
			log_error(error);
			msg.reactEmoji('error', true);
		} );
	} else {
		args[0] = line.split(' ')[1];
		cmd_help(lang, msg, args, line);
	}
}

/**
 * Filter the reactions to add to the poll
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_umfrage(lang, msg, args, line) {
	var imgs = [];
	if ( msg.uploadFiles() ) imgs = msg.attachments.map( function(img) {
		return {attachment:img.url,name:img.filename};
	} );
	if ( args.length || imgs.length ) {
		var text = args.join(' ').split('\n');
		args = text.shift().split(' ');
		if ( text.length ) args.push('\n' + text.join('\n'));
		var reactions = [];
		args = args.toEmojis();
		for ( var i = 0; ( i < args.length || imgs.length ); i++ ) {
			var reaction = args[i];
			var custom = /^<a?:/;
			var pattern = /^[\u0000-\u1FFF]{1,4}$/;
			if ( !custom.test(reaction) && ( reaction.length > 4 || pattern.test(reaction) ) ) {
				cmd_sendumfrage(lang, msg, args.slice(i).join(' ').replace( /^\n| (\n)/, '$1' ), reactions, imgs);
				break;
			} else if ( reaction !== '' ) {
				if ( custom.test(reaction) ) {
					reaction = reaction.substring(reaction.lastIndexOf(':') + 1, reaction.length - 1);
				}
				reactions[i] = reaction;
				if ( i === args.length - 1 ) {
					cmd_sendumfrage(lang, msg, args.slice(i + 1).join(' ').replace( /^\n| (\n)/, '$1' ), reactions, imgs);
					break;
				}
			}
		}
	} else {
		args[0] = line.split(' ')[1];
		cmd_help(lang, msg, args, line);
	}
}

/**
 * Send a poll
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [text] The text to send
 * @param {String[]} [reactions] The reactions to add
 * @param {Object[]} [imgs] The files to send
 */
function cmd_sendumfrage(lang, msg, text, reactions, imgs) {
	msg.channel.send( lang.poll.title + text, {disableEveryone:!msg.member.hasPermission(['MENTION_EVERYONE']),files:imgs} ).then( poll => {
		msg.deleteMsg();
		if ( reactions.length ) {
			reactions.forEach( function(entry) {
				poll.react(entry).catch( error => {
					log_error(error);
					poll.reactEmoji('error');
				} );
			} );
		} else {
			poll.reactEmoji('support');
			poll.reactEmoji('oppose');
		}
	}, error => {
		log_error(error);
		msg.reactEmoji('error');
	} );
}

/**
 * Test if the bot works
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_test(lang, msg, args, line) {
	if ( args.join('') ) {
		if ( msg.channel.type !== 'text' || !pause[msg.guild.id] ) cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	} else if ( msg.channel.type !== 'text' || !pause[msg.guild.id] ) {
		var text = lang.test.text[Math.floor(Math.random() * lang.test.random)] || lang.test.default;
		console.log( '- Test: Fully functioning!' );
		var now = Date.now();
		msg.replyMsg( text ).then( edit => {
			var then = Date.now();
			var embed = new Discord.RichEmbed().setTitle( lang.test.time ).addField( 'Discord', ( then - now ) + 'ms' );
			now = Date.now();
			request( {
				uri: msg.channel.getWiki() + 'api.php?action=query&format=json',
				json: true
			}, function( error, response, body ) {
				then = Date.now();
				if ( body && body.warnings ) log_warn(body.warnings);
				var ping = ( then - now ) + 'ms';
				if ( error || !response || response.statusCode !== 200 || !body || !( body instanceof Object ) ) {
					if ( response && response.request && response.request.uri && msg.channel.getWiki().noWiki(response.request.uri.href) ) {
						console.log( '- This wiki doesn\'t exist!' );
						ping += ' <:unknown_wiki:505887262077353984>';
					}
					else {
						console.log( '- ' + ( response && response.statusCode ) + ': Error while reaching the wiki: ' + ( error || body && body.error && body.error.info ) );
						ping += ' <:error:505887261200613376>';
					}
				}
				embed.addField( msg.channel.getWiki(), ping );
				if ( edit ) edit.edit( edit.content, embed ).catch(log_error);
			} );
		} );
	} else {
		console.log( '- Test: Paused!' );
		msg.replyMsg( lang.test.pause, {}, true );
	}
}

/**
 * Evaluate code
 * @async
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
async function cmd_eval(lang, msg, args, line) {
	try {
		var text = util.inspect( await eval( args.join(' ') ) );
	} catch ( error ) {
		var text = error.toString();
	}
	if ( isDebug ) console.log( '--- EVAL START ---\n' + text + '\n--- EVAL END ---' );
	if ( text.length > 2000 ) msg.reactEmoji('✅', true);
	else msg.sendChannel( '```js\n' + text + '\n```', {split:{prepend:'```js\n',append:'\n```'}}, true );
}

/**
 * Kill the bot
 * @async
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
async function cmd_stop(lang, msg, args, line) {
	if ( args.join(' ').split('\n')[0].isMention(msg.guild) ) {
		await msg.replyMsg( 'I\'ll destroy myself now!', {}, true );
		await client.destroy();
		console.log( '- I\'m now shutting down!' );
		setTimeout( async () => {
			console.log( '- I need to long to close, terminating!' );
			process.exit(1);
		}, 1000 ).unref();
	} else if ( msg.channel.type !== 'text' || !pause[msg.guild.id] ) {
		cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	}
}

/**
 * Switch pause mode
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_pause(lang, msg, args, line) {
	if ( msg.channel.type === 'text' && args.join(' ').split('\n')[0].isMention(msg.guild) && ( msg.isAdmin() || msg.isOwner() ) ) {
		if ( pause[msg.guild.id] ) {
			delete pause[msg.guild.id];
			console.log( '- Pause ended.' );
			msg.replyMsg( lang.pause.off, {}, true );
		} else {
			msg.replyMsg( lang.pause.on, {}, true );
			console.log( '- Pause started.' );
			pause[msg.guild.id] = true;
		}
	} else if ( msg.channel.type !== 'text' || !pause[msg.guild.id] ) {
		cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	}
}

/**
 * Delete the last messages
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_delete(lang, msg, args, line) {
	if ( msg.channel.memberPermissions(msg.member).has('MANAGE_MESSAGES') ) {
		if ( /^\d+$/.test(args[0]) && parseInt(args[0], 10) + 1 > 0 ) {
			if ( parseInt(args[0], 10) > 99 ) {
				msg.replyMsg( lang.delete.big.replace( '%s', '`99`' ), {}, true );
			}
			else {
				msg.channel.bulkDelete(parseInt(args[0], 10) + 1, true).then( messages => {
					msg.reply( lang.delete.success.replace( '%s', messages.size - 1 ) ).then( antwort => antwort.deleteMsg(5000), log_error );
					console.log( '- The last ' + ( messages.size - 1 ) + ' messages in #' + msg.channel.name + ' were deleted by @' + msg.member.displayName + '!' );
				}, log_error );
			}
		}
		else {
			msg.replyMsg( lang.delete.invalid, {}, true );
		}
	}
	else {
		msg.reactEmoji('❌');
	}
}

/**
 * Search or switch the wiki
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [title] The searchterm
 * @param {String} [wiki=msg.channel.getWiki()] The current wiki
 * @param {String} [cmd=' '] The command to the current wiki
 */
function cmd_link(lang, msg, title, wiki = msg.channel.getWiki(), cmd = ' ') {
	if ( cmd === ' ' && msg.isAdmin() && !( msg.guild.id in settings ) && settings !== defaultSettings ) {
		cmd_settings(lang, msg, [], '');
	}
	if ( /^\|\|(?:(?!\|\|).)+\|\|$/.test(title) ) {
		title = title.substring( 2, title.length - 2);
		var spoiler = '||';
	}
	msg.reactEmoji('⏳').then( reaction => check_wiki(lang, msg, title, wiki, cmd, reaction, spoiler) );
}

/**
 * Search or switch the wiki
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [title] The searchterm
 * @param {String} [wiki] The current wiki
 * @param {String} [cmd] The command to the current wiki
 * @param {Discord.MessageReaction} [reaction] The waiting reaction
 * @param {String} [spoiler=''] The pipes if the message is a spoiler
 * @param {String} [querystring=''] The querystring for the page
 * @param {String} [fragment=''] The section of the page
 * @param {Number} [selfcall=0] The number of recursive calls
 */
function check_wiki(lang, msg, title, wiki, cmd, reaction, spoiler = '', querystring = '', fragment = '', selfcall = 0) {
	if ( title.includes( '#' ) ) {
		fragment = title.split('#').slice(1).join('#');
		title = title.split('#')[0];
	}
	if ( /\?\w+=/.test(title) ) {
		var querystart = title.search(/\?\w+=/);
		querystring = title.substring(querystart + 1) + ( querystring ? '&' + querystring : '' );
		title = title.substring(0, querystart);
	}
	var linksuffix = ( querystring ? '?' + querystring.toTitle() : '' ) + ( fragment ? '#' + fragment.toSection() : '' );
	if ( title.length > 300 ) {
		title = title.substring(0, 300);
		msg.reactEmoji('⚠');
	}
	var invoke = title.split(' ')[0].toLowerCase();
	var aliasInvoke = ( lang.aliase[invoke] || invoke );
	var args = title.split(' ').slice(1);
	
	if ( aliasInvoke === 'random' && !args.join('') && !linksuffix ) cmd_random(lang, msg, wiki, reaction, spoiler);
	else if ( aliasInvoke === 'overview' && !args.join('') && !linksuffix ) cmd_overview(lang, msg, wiki, reaction, spoiler);
	else if ( aliasInvoke === 'page' ) {
		msg.sendChannel( spoiler + '<' + wiki.toLink() + args.join('_').toTitle() + linksuffix + '>' + spoiler );
		if ( reaction ) reaction.removeEmoji();
	}
	else if ( aliasInvoke === 'search' ) {
		linksuffix = ( linksuffix.startsWith( '?' ) ? '&' + linksuffix.substring(1) : linksuffix );
		msg.sendChannel( spoiler + '<' + wiki.toLink() + 'Special:Search?search=' + args.join(' ').toSearch() + linksuffix + '>' + spoiler );
		if ( reaction ) reaction.removeEmoji();
	}
	else if ( aliasInvoke === 'diff' && args.join('') ) cmd_diff(lang, msg, args, wiki, reaction, spoiler);
	else {
		var noRedirect = ( /(?:^|&)redirect=no(?:&|$)/.test(querystring) || /(?:^|&)action=(?!view(?:&|$))/.test(querystring) );
		request( {
			uri: wiki + 'api.php?action=query&meta=allmessages|siteinfo&ammessages=description&amenableparser=true&siprop=general|namespaces|specialpagealiases|wikidesc&iwurl=true' + ( noRedirect ? '' : '&redirects=true' ) + '&prop=imageinfo|categoryinfo&titles=' + encodeURIComponent( title ) + '&format=json',
			json: true
		}, function( error, response, body ) {
			if ( body && body.warnings ) log_warn(body.warnings);
			if ( error || !response || response.statusCode !== 200 || !body || !body.query ) {
				if ( response && response.request && response.request.uri && wiki.noWiki(response.request.uri.href) ) {
					console.log( '- This wiki doesn\'t exist!' );
					msg.reactEmoji('nowiki');
				}
				else {
					console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the search results: ' + ( error || body && body.error && body.error.info ) );
					msg.sendChannelError( spoiler + '<' + wiki.toLink() + ( linksuffix || !title ? title.toTitle() + linksuffix : 'Special:Search?search=' + title.toSearch() ) + '>' + spoiler );
				}
				
				if ( reaction ) reaction.removeEmoji();
			}
			else {
				if ( body.query.pages ) {
					var querypages = Object.values(body.query.pages);
					var querypage = querypages[0];
					if ( body.query.redirects && body.query.redirects[0].from.split(':')[0] === body.query.namespaces['-1']['*'] && body.query.specialpagealiases.filter( sp => ['Mypage','Mytalk','MyLanguage'].includes( sp.realname ) ).map( sp => sp.aliases[0] ).includes( body.query.redirects[0].from.split(':').slice(1).join(':').split('/')[0].replace( / /g, '_' ) ) ) {
						querypage.title = body.query.redirects[0].from;
						delete body.query.redirects[0].tofragment;
						delete querypage.missing;
						querypage.ns = -1;
						querypage.special = '';
					}
					if ( querypages.length !== 1 ) querypage = {
						title: title,
						invalidreason: 'The requested page title contains invalid characters: "|".',
						invalid: ''
					}
					
					var contribs = body.query.namespaces['-1']['*'] + ':' + body.query.specialpagealiases.find( sp => sp.realname === 'Contributions' ).aliases[0] + '/';
					if ( querypage.ns === 2 && ( !querypage.title.includes( '/' ) || /^[^:]+:(?:(?:\d{1,3}\.){3}\d{1,3}\/\d{2}|(?:[\dA-F]{1,4}:){7}[\dA-F]{1,4}\/\d{2,3})$/.test(querypage.title) ) ) {
						var userparts = querypage.title.split(':');
						querypage.noRedirect = noRedirect;
						cmd_user(lang, msg, userparts[0].toTitle() + ':', userparts.slice(1).join(':'), wiki, linksuffix, querypage, contribs.toTitle(), reaction, spoiler);
					}
					else if ( querypage.ns === -1 && querypage.title.startsWith( contribs ) && querypage.title.length > contribs.length ) {
						var username = querypage.title.split('/').slice(1).join('/');
						request( {
							uri: wiki + 'api.php?action=query&titles=User:' + encodeURIComponent( username ) + '&format=json',
							json: true
						}, function( uerror, uresponse, ubody ) {
							if ( uerror || !uresponse || uresponse.statusCode !== 200 || !ubody || !ubody.query ) {
								console.log( '- ' + ( uresponse && uresponse.statusCode ) + ': Error while getting the user: ' + ( uerror || ubody && ubody.error && ubody.error.info ) );
								msg.sendChannelError( spoiler + '<' + wiki.toLink() + ( contribs + username ).toTitle() + linksuffix + '>' + spoiler );
								
								if ( reaction ) reaction.removeEmoji();
							}
							else {
								querypage = Object.values(ubody.query.pages)[0];
								if ( querypage.ns === 2 ) {
									username = querypage.title.split(':').slice(1).join(':');
									querypage.title = contribs + username;
									delete querypage.missing;
									querypage.ns = -1;
									querypage.special = '';
									querypage.noRedirect = noRedirect;
									cmd_user(lang, msg, contribs.toTitle(), username, wiki, linksuffix, querypage, contribs.toTitle(), reaction, spoiler);
								}
								else {
									msg.reactEmoji('error');
									
									if ( reaction ) reaction.removeEmoji();
								}
							}
						} );
					}
					else if ( querypage.ns === 1201 && querypage.missing !== undefined ) {
						var thread = querypage.title.split(':');
						request( {
							uri: wiki + 'api.php?action=query&prop=revisions&rvprop=user&rvdir=newer&rvlimit=1&pageids=' + thread.slice(1).join(':') + '&format=json',
							json: true
						}, function( therror, thresponse, thbody ) {
							if ( therror || !thresponse || thresponse.statusCode !== 200 || !thbody || !thbody.query || !thbody.query.pages ) {
								console.log( '- ' + ( thresponse && thresponse.statusCode ) + ': Error while getting the thread: ' + ( therror || thbody && thbody.error && thbody.error.info ) );
								msg.sendChannelError( spoiler + '<' + wiki.toLink() + querypage.title.toTitle() + '>' + spoiler );
								
								if ( reaction ) reaction.removeEmoji();
							}
							else {
								querypage = thbody.query.pages[thread.slice(1).join(':')];
								if ( querypage.missing !== undefined ) {
									msg.reactEmoji('🤷');
									
									if ( reaction ) reaction.removeEmoji();
								}
								else {
									var pagelink = wiki.toLink() + thread.join(':').toTitle() + linksuffix;
									var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( thread.join(':').escapeFormatting() ).setURL( pagelink ).setFooter( querypage.revisions[0].user );
									
									request( {
										uri: wiki.toLink() + encodeURIComponent( querypage.title.replace( / /g, '_' ) )
									}, function( descerror, descresponse, descbody ) {
										if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
											console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
										} else {
											var thumbnail = wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png';
											var parser = new htmlparser.Parser( {
												onopentag: (tagname, attribs) => {
													if ( tagname === 'meta' && attribs.property === 'og:description' ) {
														var description = attribs.content.escapeFormatting();
														if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
														embed.setDescription( description );
													}
													if ( tagname === 'meta' && attribs.property === 'og:image' ) {
														thumbnail = attribs.content;
													}
												}
											}, {decodeEntities:true} );
											parser.write( descbody );
											parser.end();
											embed.setThumbnail( thumbnail );
										}
										
										msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, embed );
										
										if ( reaction ) reaction.removeEmoji();
									} );
								}
							}
						} );
					}
					else if ( ( querypage.missing !== undefined && querypage.known === undefined && !( noRedirect || querypage.categoryinfo ) ) || querypage.invalid !== undefined ) {
						if ( aliasInvoke === 'discussion' && !linksuffix ) cmd_discussion(lang, msg, wiki, args.join(' '), body.query, reaction, spoiler);
						else request( {
							uri: wiki + 'api/v1/Search/List?minArticleQuality=0&namespaces=4,12,14,' + Object.values(body.query.namespaces).filter( ns => ns.content !== undefined ).map( ns => ns.id ).join(',') + '&limit=10&query=' + encodeURIComponent( title ) + '&format=json',
							json: true
						}, function( wserror, wsresponse, wsbody ) {
							if ( wserror || !wsresponse || wsresponse.statusCode !== 200 || !wsbody || wsbody.exception || !wsbody.total || !wsbody.items || !wsbody.items.length ) {
								if ( wsbody && ( !wsbody.total || ( wsbody.items && !wsbody.items.length ) || ( wsbody.exception && wsbody.exception.code === 404 ) ) ) msg.reactEmoji('🤷');
								else {
									console.log( '- ' + ( wsresponse && wsresponse.statusCode ) + ': Error while getting the search results: ' + ( wserror || wsbody && wsbody.exception && wsbody.exception.details ) );
									msg.sendChannelError( spoiler + '<' + wiki.toLink() + 'Special:Search?search=' + title.toSearch() + '>' + spoiler );
								}
								
								if ( reaction ) reaction.removeEmoji();
							}
							else {
								querypage = wsbody.items[0];
								if ( querypage.ns && !querypage.title.startsWith( body.query.namespaces[querypage.ns]['*'] + ':' ) ) {
									querypage.title = body.query.namespaces[querypage.ns]['*'] + ':' + querypage.title;
								}
								
								var text = '';
								if ( title.replace( /\-/g, ' ' ).toTitle().toLowerCase() === querypage.title.replace( /\-/g, ' ' ).toTitle().toLowerCase() ) {
									text = '';
								}
								else if ( wsbody.total === 1 ) {
									text = '\n' + lang.search.infopage.replaceSave( '%s', '`' + process.env.prefix + cmd + lang.search.page + ' ' + title + linksuffix + '`' );
								}
								else {
									text = '\n' + lang.search.infosearch.replaceSave( '%1$s', '`' + process.env.prefix + cmd + lang.search.page + ' ' + title + linksuffix + '`' ).replaceSave( '%2$s', '`' + process.env.prefix + cmd + lang.search.search + ' ' + title + linksuffix + '`' );
								}
								request( {
									uri: wiki + 'api.php?action=query&prop=imageinfo|categoryinfo&titles=' + encodeURIComponent( querypage.title ) + '&format=json',
									json: true
								}, function( srerror, srresponse, srbody ) {
									if ( srbody && srbody.warnings ) log_warn(srbody.warnings);
									if ( srerror || !srresponse || srresponse.statusCode !== 200 || !srbody || !srbody.query || !srbody.query.pages ) {
										console.log( '- ' + ( srresponse && srresponse.statusCode ) + ': Error while getting the search results: ' + ( srerror || srbody && srbody.error && srbody.error.info ) );
										msg.sendChannelError( spoiler + '<' + wiki.toLink() + querypage.title.toTitle() + '>' + spoiler );
										
										if ( reaction ) reaction.removeEmoji();
									}
									else {
										querypage = Object.values(srbody.query.pages)[0];
										var pagelink = wiki.toLink() + querypage.title.toTitle() + linksuffix;
										var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( querypage.title.escapeFormatting() ).setURL( pagelink );
										if ( querypage.imageinfo ) {
											var filename = querypage.title.replace( body.query.namespaces['6']['*'] + ':', '' );
											var pageimage = wiki.toLink() + 'Special:FilePath/' + filename.toTitle() + '?v=' + Date.now();
											if ( msg.showEmbed() && /\.(?:png|jpg|jpeg|gif)$/.test(querypage.title.toLowerCase()) ) embed.setImage( pageimage );
											else if ( msg.uploadFiles() ) embed.attachFiles( [{attachment:pageimage,name:( spoiler ? 'SPOILER ' : '' ) + filename}] );
										}
										if ( querypage.categoryinfo ) {
											var langCat = lang.search.category;
											var category = [langCat.content];
											if ( querypage.categoryinfo.size === 0 ) category.push(langCat.empty);
											if ( querypage.categoryinfo.pages > 0 ) {
												var pages = querypage.categoryinfo.pages;
												category.push(( langCat.pages[pages] || langCat.pages['*' + pages % 100] || langCat.pages['*' + pages % 10] || langCat.pages.default ).replaceSave( '%s', pages ));
											}
											if ( querypage.categoryinfo.files > 0 ) {
												var files = querypage.categoryinfo.files;
												category.push(( langCat.files[files] || langCat.files['*' + files % 100] || langCat.files['*' + files % 10] || langCat.files.default ).replaceSave( '%s', files ));
											}
											if ( querypage.categoryinfo.subcats > 0 ) {
												var subcats = querypage.categoryinfo.subcats;
												category.push(( langCat.subcats[subcats] || langCat.subcats['*' + subcats % 100] || langCat.subcats['*' + subcats % 10] || langCat.subcats.default ).replaceSave( '%s', subcats ));
											}
											if ( msg.showEmbed() ) embed.addField( category[0], category.slice(1).join('\n') );
											else text += '\n\n' + category.join('\n');
										}
										
										if ( querypage.title === body.query.general.mainpage && body.query.allmessages[0]['*'] ) {
											embed.setDescription( body.query.allmessages[0]['*'] );
											embed.setThumbnail( wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png' );
											
											msg.sendChannel( spoiler + '<' + pagelink + '>' + text + spoiler, embed );
											
											if ( reaction ) reaction.removeEmoji();
										}
										else request( {
											uri: wiki.toLink() + encodeURIComponent( querypage.title.replace( / /g, '_' ) )
										}, function( descerror, descresponse, descbody ) {
											if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
												console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
											} else {
												var thumbnail = wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png';
												var parser = new htmlparser.Parser( {
													onopentag: (tagname, attribs) => {
														if ( tagname === 'meta' && attribs.property === 'og:description' ) {
															var description = attribs.content.escapeFormatting();
															if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
															embed.setDescription( description );
														}
														if ( tagname === 'meta' && attribs.property === 'og:image' && querypage.title !== body.query.general.mainpage ) {
															thumbnail = attribs.content;
														}
													}
												}, {decodeEntities:true} );
												parser.write( descbody );
												parser.end();
												if ( !querypage.imageinfo ) embed.setThumbnail( thumbnail );
											}
											
											msg.sendChannel( spoiler + '<' + pagelink + '>' + text + spoiler, embed );
											
											if ( reaction ) reaction.removeEmoji();
										} );
									}
								} );
							}
						} );
					}
					else {
						var pagelink = wiki.toLink() + querypage.title.toTitle() + ( querystring ? '?' + querystring.toTitle() : '' ) + ( body.query.redirects && body.query.redirects[0].tofragment ? '#' + body.query.redirects[0].tofragment.toSection() : ( fragment ? '#' + fragment.toSection() : '' ) );
						var text = '';
						var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( querypage.title.escapeFormatting() ).setURL( pagelink );
						if ( querypage.imageinfo ) {
							var filename = querypage.title.replace( body.query.namespaces['6']['*'] + ':', '' );
							var pageimage = wiki.toLink() + 'Special:FilePath/' + filename.toTitle() + '?v=' + Date.now();
							if ( msg.showEmbed() && /\.(?:png|jpg|jpeg|gif)$/.test(querypage.title.toLowerCase()) ) embed.setImage( pageimage );
							else if ( msg.uploadFiles() ) embed.attachFiles( [{attachment:pageimage,name:( spoiler ? 'SPOILER ' : '' ) + filename}] );
						}
						if ( querypage.categoryinfo ) {
							var langCat = lang.search.category;
							var category = [langCat.content];
							if ( querypage.categoryinfo.size === 0 ) category.push(langCat.empty);
							if ( querypage.categoryinfo.pages > 0 ) {
								var pages = querypage.categoryinfo.pages;
								category.push(( langCat.pages[pages] || langCat.pages['*' + pages % 100] || langCat.pages['*' + pages % 10]  || langCat.pages.default ).replaceSave( '%s', pages ));
							}
							if ( querypage.categoryinfo.files > 0 ) {
								var files = querypage.categoryinfo.files;
								category.push(( langCat.files[files] || langCat.files['*' + files % 100] || langCat.files['*' + files % 10]  || langCat.files.default ).replaceSave( '%s', files ));
							}
							if ( querypage.categoryinfo.subcats > 0 ) {
								var subcats = querypage.categoryinfo.subcats;
								category.push(( langCat.subcats[subcats] || langCat.subcats['*' + subcats % 100] || langCat.subcats['*' + subcats % 10]  || langCat.subcats.default ).replaceSave( '%s', subcats ));
							}
							if ( msg.showEmbed() ) embed.addField( category[0], category.slice(1).join('\n') );
							else text += '\n\n' + category.join('\n');
						}
						
						if ( querypage.title === body.query.general.mainpage && body.query.allmessages[0]['*'] ) {
							embed.setDescription( body.query.allmessages[0]['*'] );
							embed.setThumbnail( wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png' );
							
							msg.sendChannel( spoiler + '<' + pagelink + '>' + text + spoiler, embed );
							
							if ( reaction ) reaction.removeEmoji();
						}
						else request( {
							uri: wiki.toLink() + encodeURIComponent( querypage.title.replace( / /g, '_' ) )
						}, function( descerror, descresponse, descbody ) {
							if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
								console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
							} else {
								var thumbnail = wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png';
								var parser = new htmlparser.Parser( {
									onopentag: (tagname, attribs) => {
										if ( tagname === 'meta' && attribs.property === 'og:description' ) {
											var description = attribs.content.escapeFormatting();
											if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
											embed.setDescription( description );
										}
										if ( tagname === 'meta' && attribs.property === 'og:image' && querypage.title !== body.query.general.mainpage ) {
											thumbnail = attribs.content;
										}
									}
								}, {decodeEntities:true} );
								parser.write( descbody );
								parser.end();
								if ( !querypage.imageinfo ) embed.setThumbnail( thumbnail );
							}
							
							msg.sendChannel( spoiler + '<' + pagelink + '>' + text + spoiler, embed );
							
							if ( reaction ) reaction.removeEmoji();
						} );
					}
				}
				else if ( body.query.interwiki ) {
					var inter = body.query.interwiki[0];
					var intertitle = inter.title.substring(inter.iw.length + 1);
					var regex = inter.url.match( /^(?:https?:)?\/\/(([a-z\d-]{1,50})\.(?:fandom\.com|wikia\.org)(?:(?!\/wiki\/)\/([a-z-]{1,8}))?)(?:\/wiki\/|\/?$)/ );
					if ( regex !== null && selfcall < 5 ) {
						if ( msg.channel.type !== 'text' || !pause[msg.guild.id] ) {
							var iwtitle = decodeURIComponent( inter.url.replace( regex[0], '' ) ).replace( /\_/g, ' ' ).replaceSave( intertitle.replace( /\_/g, ' ' ), intertitle );
							selfcall++;
							check_wiki(lang, msg, iwtitle, 'https://' + regex[1] + '/', ' !' + ( regex[3] ? regex[3] + '.' : '' ) + regex[2] + ' ', reaction, spoiler, querystring, fragment, selfcall);
						} else {
							if ( reaction ) reaction.removeEmoji();
							console.log( '- Aborted, paused.' );
						}
					} else {
						if ( fragment ) fragment = '#' + fragment.toSection();
						if ( inter.url.includes( '#' ) ) {
							if ( !fragment ) fragment = '#' + inter.url.split('#').slice(1).join('#');
							inter.url = inter.url.split('#')[0];
						}
						if ( querystring ) inter.url += ( inter.url.includes( '?' ) ? '&' : '?' ) + querystring.toTitle();
						msg.sendChannel( spoiler + ' ' + inter.url.replace( /@(here|everyone)/g, '%40$1' ) + fragment + ' ' + spoiler ).then( message => {
							if ( message && selfcall === 5 ) message.reactEmoji('⚠');
						} );
						if ( reaction ) reaction.removeEmoji();
					}
				}
				else {
					var pagelink = wiki.toLink() + body.query.general.mainpage.toTitle() + linksuffix;
					var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( body.query.general.mainpage.escapeFormatting() ).setURL( pagelink ).setThumbnail( wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png' );
					
					if ( body.query.allmessages[0]['*'] ) {
						embed.setDescription( body.query.allmessages[0]['*'] );
						
						msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, embed );
						
						if ( reaction ) reaction.removeEmoji();
					}
					else request( {
						uri: wiki.toLink() + encodeURIComponent( body.query.general.mainpage.replace( / /g, '_' ) )
					}, function( descerror, descresponse, descbody ) {
						if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
							console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
						} else {
							var parser = new htmlparser.Parser( {
								onopentag: (tagname, attribs) => {
									if ( tagname === 'meta' && attribs.property === 'og:description' ) {
										var description = attribs.content.escapeFormatting();
										if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
										embed.setDescription( description );
									}
								}
							}, {decodeEntities:true} );
							parser.write( descbody );
							parser.end();
						}
						
						msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, embed );
						
						if ( reaction ) reaction.removeEmoji();
					} );
				}
			}
		} );
	}
}

/**
 * Send information about a user
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [namespace] The namespace
 * @param {String} [username] The username
 * @param {String} [wiki] The current wiki
 * @param {String} [linksuffix] The linksuffix
 * @param {Object} [querypage] Data about the page
 * @param {String} [contribs] Localized name of the Special:Contributions page
 * @param {Discord.MessageReaction} [reaction] The waiting reaction
 * @param {String} [spoiler] The pipes if the message is a spoiler
 */
function cmd_user(lang, msg, namespace, username, wiki, linksuffix, querypage, contribs, reaction, spoiler) {
	if ( /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{2})?|(?:[\dA-F]{1,4}:){7}[\dA-F]{1,4}(?:\/\d{2,3})?)$/.test(username) ) {
		request( {
			uri: wiki + 'api.php?action=query&meta=siteinfo&siprop=general&list=blocks&bkprop=user|by|timestamp|expiry|reason&bkip=' + encodeURIComponent( username ) + '&format=json',
			json: true
		}, function( error, response, body ) {
			if ( body && body.warnings ) log_warn(body.warnings);
			if ( error || !response || response.statusCode !== 200 || !body || !body.query || !body.query.blocks ) {
				if ( response && response.request && response.request.uri && wiki.noWiki(response.request.uri.href) ) {
					console.log( '- This wiki doesn\'t exist!' );
					msg.reactEmoji('nowiki');
					
					if ( reaction ) reaction.removeEmoji();
				}
				else if ( body && body.error && ( body.error.code === 'param_ip' || body.error.code === 'cidrtoobroad' ) ) {
					if ( querypage.missing !== undefined || querypage.ns === -1 ) {
						msg.reactEmoji('error');
						
						if ( reaction ) reaction.removeEmoji();
					}
					else {
						var pagelink = wiki.toLink() + querypage.title.toTitle() + linksuffix;
						var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( querypage.title.escapeFormatting() ).setURL( pagelink );
						request( {
							uri: wiki.toLink() + encodeURIComponent( querypage.title.replace( / /g, '_' ) )
						}, function( descerror, descresponse, descbody ) {
							if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
								console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
							} else {
								var thumbnail = wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png';
								var parser = new htmlparser.Parser( {
									onopentag: (tagname, attribs) => {
										if ( tagname === 'meta' && attribs.property === 'og:description' ) {
											var description = attribs.content.escapeFormatting();
											if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
											embed.setDescription( description );
										}
										if ( tagname === 'meta' && attribs.property === 'og:image' ) {
											thumbnail = attribs.content;
										}
									}
								}, {decodeEntities:true} );
								parser.write( descbody );
								parser.end();
								embed.setThumbnail( thumbnail );
							}
							
							msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, embed );
							
							if ( reaction ) reaction.removeEmoji();
						} );
					}
				}
				else {
					console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the search results: ' + ( error || body && body.error && body.error.info ) );
					msg.sendChannelError( spoiler + '<' + wiki.toLink() + ( querypage.noRedirect ? namespace : contribs ) + username.toTitle() + linksuffix + '>' + spoiler );
					
					if ( reaction ) reaction.removeEmoji();
				}
			}
			else {
				if ( !querypage.noRedirect || ( querypage.missing === undefined && querypage.ns !== -1 ) ) namespace = contribs;
				var blocks = body.query.blocks.map( function(block) {
					var isBlocked = false;
					var blockedtimestamp = new Date(block.timestamp).toLocaleString(lang.dateformat, timeoptions);
					var blockexpiry = block.expiry;
					if ( blockexpiry === 'infinity' ) {
						blockexpiry = lang.user.block.until_infinity;
						isBlocked = true;
					} else if ( blockexpiry ) {
						if ( Date.parse(blockexpiry) > Date.now() ) isBlocked = true;
						blockexpiry = new Date(blockexpiry).toLocaleString(lang.dateformat, timeoptions);
					}
					if ( isBlocked ) return [lang.user.block.header.replaceSave( '%s', block.user ), lang.user.block[( block.reason ? 'text' : 'noreason' )].replaceSave( '%1$s', blockedtimestamp ).replaceSave( '%2$s', blockexpiry ).replaceSave( '%3$s', '[[User:' + block.by + '|' + block.by + ']]' ).replaceSave( '%4$s', block.reason )];
				} ).filter( block => block !== undefined );
				if ( username.includes( '/' ) ) {
					var rangeprefix = username;
					if ( username.includes( ':' ) ) {
						var range = parseInt(username.replace( /^.+\/(\d{2,3})$/, '$1' ), 10);
						if ( range === 128 ) username = username.replace( /^(.+)\/\d{2,3}$/, '$1' );
						else if ( range >= 112 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){7}).+$/, '$1' );
						else if ( range >= 96 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){6}).+$/, '$1' );
						else if ( range >= 80 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){5}).+$/, '$1' );
						else if ( range >= 64 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){4}).+$/, '$1' );
						else if ( range >= 48 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){3}).+$/, '$1' );
						else if ( range >= 32 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){2}).+$/, '$1' );
						else if ( range >= 19 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){1}).+$/, '$1' );
					}
					else {
						var range = parseInt(username.substring(username.length - 2), 10);
						if ( range === 32 ) username = username.replace( /^(.+)\/\d{2}$/, '$1' );
						else if ( range >= 24 ) rangeprefix = username.replace( /^((?:\d{1,3}\.){3}).+$/, '$1' );
						else if ( range >= 16 ) rangeprefix = username.replace( /^((?:\d{1,3}\.){2}).+$/, '$1' );
					}
				}
				request( {
					uri: wiki + 'api.php?action=query&list=usercontribs&ucprop=&uclimit=50&ucuser=' + encodeURIComponent( username ) + '&format=json',
					json: true
				}, function( ucerror, ucresponse, ucbody ) {
					if ( rangeprefix && !username.includes( '/' ) ) username = rangeprefix;
					if ( ucbody && ucbody.warnings ) log_warn(ucbody.warnings);
					if ( ucerror || !ucresponse || ucresponse.statusCode !== 200 || !ucbody || !ucbody.query || !ucbody.query.usercontribs ) {
						if ( ucbody && ucbody.error && ucbody.error.code === 'baduser_ucuser' ) {
							msg.reactEmoji('error');
						}
						else {
							console.log( '- ' + ( ucresponse && ucresponse.statusCode ) + ': Error while getting the search results: ' + ( ucerror || ucbody && ucbody.error && ucbody.error.info ) );
							msg.sendChannelError( spoiler + '<' + wiki.toLink() + namespace + username.toTitle() + linksuffix + '>' + spoiler );
						}
					}
					else {
						var editcount = [lang.user.info.editcount, ( username.includes( '/' ) ? '~' : '' ) + ucbody.query.usercontribs.length + ( ucbody.continue ? '+' : '' )];
						
						var pagelink = wiki.toLink() + namespace + username.toTitle() + linksuffix;
						if ( msg.showEmbed() ) {
							var text = '<' + pagelink + '>';
							var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( username ).setURL( pagelink ).addField( editcount[0], '[' + editcount[1] + '](' + wiki.toLink() + contribs + username.toTitle() + ')' );
							if ( blocks.length ) blocks.forEach( block => embed.addField( block[0], block[1].toMarkdown(wiki) ) );
						}
						else {
							var embed = {};
							var text = '<' + pagelink + '>\n\n' + editcount.join(' ');
							if ( blocks.length ) blocks.forEach( block => text += '\n\n**' + block[0] + '**\n' + block[1].toPlaintext() );
						}
						
						msg.sendChannel( spoiler + text + spoiler, embed );
					}
					
					if ( reaction ) reaction.removeEmoji();
				} );
			}
		} );
	} else {
		request( {
			uri: wiki + 'api.php?action=query&meta=siteinfo&siprop=general&list=users&usprop=blockinfo|groups|editcount|registration|gender&ususers=' + encodeURIComponent( username ) + '&format=json',
			json: true
		}, function( error, response, body ) {
			if ( body && body.warnings ) log_warn(body.warnings);
			if ( error || !response || response.statusCode !== 200 || !body || !body.query || !body.query.users ) {
				if ( response && response.request && response.request.uri && wiki.noWiki(response.request.uri.href) ) {
					console.log( '- This wiki doesn\'t exist!' );
					msg.reactEmoji('nowiki');
				}
				else {
					console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the search results: ' + ( error || body && body.error && body.error.info ) );
					msg.sendChannelError( spoiler + '<' + wiki.toLink() + namespace + username.toTitle() + linksuffix + '>' + spoiler );
				}
				
				if ( reaction ) reaction.removeEmoji();
			}
			else {
				if ( !body.query.users[0] ) {
					if ( querypage.missing !== undefined || querypage.ns === -1 ) {
						msg.reactEmoji('🤷');
						
						if ( reaction ) reaction.removeEmoji();
					}
					else {
						var pagelink = wiki.toLink() + querypage.title.toTitle() + linksuffix;
						var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( querypage.title.escapeFormatting() ).setURL( pagelink );
						request( {
							uri: wiki.toLink() + encodeURIComponent( querypage.title.replace( / /g, '_' ) )
						}, function( descerror, descresponse, descbody ) {
							if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
								console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
							} else {
								var thumbnail = wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png';
								var parser = new htmlparser.Parser( {
									onopentag: (tagname, attribs) => {
										if ( tagname === 'meta' && attribs.property === 'og:description' ) {
											var description = attribs.content.escapeFormatting();
											if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
											embed.setDescription( description );
										}
										if ( tagname === 'meta' && attribs.property === 'og:image' ) {
											thumbnail = attribs.content;
										}
									}
								}, {decodeEntities:true} );
								parser.write( descbody );
								parser.end();
								embed.setThumbnail( thumbnail );
							}
							
							msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, embed );
							
							if ( reaction ) reaction.removeEmoji();
						} );
					}
				}
				else {
					username = body.query.users[0].name;
					var gender = [lang.user.info.gender];
					switch (body.query.users[0].gender) {
						case 'male':
							gender.push(lang.user.gender.male);
							break;
						case 'female':
							gender.push(lang.user.gender.female);
							break;
						default: 
							gender.push(lang.user.gender.unknown);
					}
					var registration = [lang.user.info.registration, new Date(body.query.users[0].registration).toLocaleString(lang.dateformat, timeoptions)];
					var editcount = [lang.user.info.editcount, body.query.users[0].editcount];
					var groups = body.query.users[0].groups;
					var group = [lang.user.info.group];
					for ( var i = 0; i < lang.user.groups.length; i++ ) {
						if ( groups.includes( lang.user.groups[i][0] ) ) {
							group.push(lang.user.groups[i][1]);
							break;
						}
					}
					var isBlocked = false;
					var blockedtimestamp = new Date(body.query.users[0].blockedtimestamp).toLocaleString(lang.dateformat, timeoptions);
					var blockexpiry = body.query.users[0].blockexpiry;
					if ( blockexpiry === 'infinity' ) {
						blockexpiry = lang.user.block.until_infinity;
						isBlocked = true;
					} else if ( blockexpiry ) {
						var blockexpirydate = blockexpiry.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2,3})/, '$1-$2-$3T$4:$5:$6Z');
						blockexpiry = new Date(blockexpirydate).toLocaleString(lang.dateformat, timeoptions);
						if ( Date.parse(blockexpirydate) > Date.now() ) isBlocked = true;
					}
					var blockedby = '[[User:' + body.query.users[0].blockedby + '|' + body.query.users[0].blockedby + ']]';
					var blockreason = body.query.users[0].blockreason;
					var block = [lang.user.block.header.replaceSave( '%s', username ), lang.user.block['nofrom' + ( blockreason ? 'text' : 'noreason' )].replaceSave( '%1$s', blockedtimestamp ).replaceSave( '%2$s', blockexpiry ).replaceSave( '%3$s', blockedby ).replaceSave( '%4$s', blockreason )];
					
					var pagelink = wiki.toLink() + namespace + username.toTitle() + linksuffix;
					if ( msg.showEmbed() ) {
						var text = '<' + pagelink + '>';
						var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( username.escapeFormatting() ).setURL( pagelink ).addField( editcount[0], '[' + editcount[1] + '](' + wiki.toLink() + contribs + username.toTitle() + ')', true ).addField( group[0], group[1], true ).addField( gender[0], gender[1], true ).addField( registration[0], registration[1], true );
					}
					else {
						var embed = {};
						var text = '<' + pagelink + '>\n\n' + gender.join(' ') + '\n' + registration.join(' ') + '\n' + editcount.join(' ') + '\n' + group.join(' ');
					}
					
					request( {
						uri: 'https://services.fandom.com/user-attribute/user/' + body.query.users[0].userid + '?format=json'
					}, function( perror, presponse, pbody ) {
						try {
							if ( pbody ) pbody = JSON.parse(pbody);
							if ( perror || !presponse || presponse.statusCode !== 200 || !pbody || pbody.title || !pbody._embedded || !pbody._embedded.properties ) {
								if ( !( pbody && pbody.status === 404 ) ) console.log( '- ' + ( presponse && presponse.statusCode ) + ': Error while getting the user profile: ' + ( perror || pbody && pbody.title ) );
							}
							else {
								var profile = pbody._embedded.properties;
								var discordfield = profile.find( field => field.name === 'discordHandle' );
								var avatarfield = profile.find( field => field.name === 'avatar' );
								if ( discordfield && discordfield.value ) {
									var parser = new htmlparser.Parser( {
										ontext: (htmltext) => {
											discordfield.value = htmltext.escapeFormatting();
										}
									}, {decodeEntities:true} );
									parser.write( discordfield.value );
									parser.end();
									var discordmember = msg.guild.members.find( member => {
										return member.user.tag.escapeFormatting() === discordfield.value.replace( /^\s*([^@#:]{2,32}?)\s*#(\d{4,6})\s*$/, '$1#$2' );
									} );
									if ( !discordmember && /^\d+$/.test(discordfield.value) ) discordmember = msg.guild.members.get(discordfield.value);
									var discordname = [lang.user.info.discord,discordfield.value];
									if ( discordmember ) {
										if ( msg.showEmbed() ) discordname[1] = discordmember.toString();
										else if ( discordmember.nickname ) discordname[1] += ' (' + discordmember.nickname.escapeFormatting() + ')';
									}
									
									if ( msg.showEmbed() ) embed.addField( discordname[0], discordname[1], true );
									else text += '\n' + discordname.join(' ');
								}
								if ( msg.showEmbed() && avatarfield && avatarfield.value ) embed.setThumbnail( avatarfield.value );
							}
						}
						catch ( jsonerror ) {
							console.log( '- ' + ( presponse && presponse.statusCode ) + ': Error while getting the user profile: ' + ( perror || jsonerror ) );
						}
						
						if ( isBlocked ) {
							if ( msg.showEmbed() ) embed.addField( block[0], block[1].toMarkdown(wiki) );
							else text += '\n\n**' + block[0] + '**\n' + block[1].toPlaintext();
						}
						
						msg.sendChannel( spoiler + text + spoiler, embed );
						
						if ( reaction ) reaction.removeEmoji();
					} );
				}
			}
		} );
	}
}

/**
 * Send a link to a discussion
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [wiki] The current wiki
 * @param {String} [title] The title to search for
 * @param {String} [query] The query with wiki metadata
 * @param {Discord.MessageReaction} [reaction] The waiting reaction
 * @param {String} [spoiler] The pipes if the message is a spoiler
 */
function cmd_discussion(lang, msg, wiki, title, query, reaction, spoiler) {
	if ( !title ) {
		var pagelink = wiki + 'f';
		var embed = new Discord.RichEmbed().setAuthor( query.general.sitename ).setTitle( lang.discussion.main ).setURL( pagelink );
		request( {
			uri: wiki + 'f'
		}, function( descerror, descresponse, descbody ) {
			if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
				console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
			} else {
				var thumbnail = wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png';
				var parser = new htmlparser.Parser( {
					onopentag: (tagname, attribs) => {
						if ( tagname === 'meta' && attribs.property === 'og:description' ) {
							var description = attribs.content.escapeFormatting();
							if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
							embed.setDescription( description );
						}
						if ( tagname === 'meta' && attribs.property === 'og:image' ) {
							thumbnail = attribs.content;
						}
					}
				}, {decodeEntities:true} );
				parser.write( descbody );
				parser.end();
				embed.setThumbnail( thumbnail );
			}
			
			msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, embed );
			
			if ( reaction ) reaction.removeEmoji();
		} );
	}
	else if ( title.split(' ')[0].toLowerCase() === 'post' || title.split(' ')[0].toLowerCase() === lang.discussion.post ) {
		title = title.split(' ').slice(1).join(' ');
		request( {
			uri: 'https://services.fandom.com/discussion/' + query.wikidesc.id + '/posts?limit=50&format=json'
		}, function( error, response, body ) {
			try {
				if ( body ) body = JSON.parse(body);
				if ( error || !response || response.statusCode !== 200 || !body || body.title || !body._embedded || !body._embedded['doc:posts'] ) {
					console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the posts: ' + ( error || body && body.title ) );
					msg.sendChannelError( spoiler + '<' + wiki + 'f' + '>' + spoiler );
					
					if ( reaction ) reaction.removeEmoji();
				}
				else if ( body._embedded['doc:posts'].length ) {
					var posts = body._embedded['doc:posts'];
					var embed = new Discord.RichEmbed().setAuthor( query.general.sitename );
					
					if ( posts.some( post => post.id === title ) ) {
						cmd_discussionsend(lang, msg, wiki, posts.find( post => post.id === title ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else if ( /^\d+$/.test(title) ) {
						request( {
							uri: 'https://services.fandom.com/discussion/' + query.wikidesc.id + '/posts/' + title + '?format=json'
						}, function( perror, presponse, pbody ) {
							try {
								if ( pbody ) pbody = JSON.parse(pbody);
								if ( perror || !presponse || presponse.statusCode !== 200 || !pbody || pbody.id !== title ) {
									if ( pbody && pbody.title === 'The requested resource was not found.' ) {
										if ( posts.some( post => post.rawContent.toLowerCase().includes( title.toLowerCase() ) ) ) {
											cmd_discussionsend(lang, msg, wiki, posts.find( post => post.rawContent.toLowerCase().includes( title.toLowerCase() ) ), embed, spoiler);
										}
										else msg.reactEmoji('🤷');
									}
									else {
										console.log( '- ' + ( presponse && presponse.statusCode ) + ': Error while getting the post: ' + ( perror || pbody && pbody.title ) );
										msg.sendChannelError( spoiler + '<' + wiki + 'f' + '>' + spoiler );
									}
									
									if ( reaction ) reaction.removeEmoji();
								}
								else if ( pbody.title ) {
									cmd_discussionsend(lang, msg, wiki, pbody, embed, spoiler);
									
									if ( reaction ) reaction.removeEmoji();
								}
								else request( {
									uri: 'https://services.fandom.com/discussion/' + query.wikidesc.id + '/threads/' + pbody.threadId + '?format=json'
								}, function( therror, thresponse, thbody ) {
									try {
										if ( thbody ) thbody = JSON.parse(thbody);
										if ( therror || !thresponse || thresponse.statusCode !== 200 || !thbody || thbody.id !== pbody.threadId ) {
											console.log( '- ' + ( thresponse && thresponse.statusCode ) + ': Error while getting the thread: ' + ( therror || thbody && thbody.title ) );
											msg.sendChannelError( spoiler + '<' + wiki + 'f/p/' + pbody.threadId + '>' + spoiler );
										}
										else embed.setTitle( thbody.title.escapeFormatting() );
									}
									catch ( jsonerror ) {
										console.log( '- ' + ( thresponse && thresponse.statusCode ) + ': Error while getting the thread: ' + ( therror || jsonerror ) );
										msg.sendChannelError( spoiler + '<' + wiki + 'f/p/' + pbody.threadId + '>' + spoiler );
									}
									cmd_discussionsend(lang, msg, wiki, pbody, embed, spoiler);
									
									if ( reaction ) reaction.removeEmoji();
								} );
							}
							catch ( jsonerror ) {
								console.log( '- ' + ( presponse && presponse.statusCode ) + ': Error while getting the post: ' + ( perror || jsonerror ) );
								msg.sendChannelError( spoiler + '<' + wiki + 'f' + '>' + spoiler );
								
								if ( reaction ) reaction.removeEmoji();
							}
						} );
					}
					else if ( posts.some( post => post.rawContent.toLowerCase().includes( title.toLowerCase() ) ) ) {
						cmd_discussionsend(lang, msg, wiki, posts.find( post => post.rawContent.toLowerCase().includes( title.toLowerCase() ) ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else {
						msg.reactEmoji('🤷');
						
						if ( reaction ) reaction.removeEmoji();
					}
				}
				else {
					msg.reactEmoji('🤷');
					
					if ( reaction ) reaction.removeEmoji();
				}
			}
			catch ( jsonerror ) {
				console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the posts: ' + ( error || jsonerror ) );
				msg.sendChannelError( spoiler + '<' + wiki + 'f' + '>' + spoiler );
				
				if ( reaction ) reaction.removeEmoji();
			}
		} );
	}
	else {
		request( {
			uri: 'https://services.fandom.com/discussion/' + query.wikidesc.id + '/threads?sortKey=trending&limit=50&format=json'
		}, function( error, response, body ) {
			try {
				if ( body ) body = JSON.parse(body);
				if ( error || !response || response.statusCode !== 200 || !body || body.title || !body._embedded || !body._embedded.threads ) {
					console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the threads: ' + ( error || body && body.title ) );
					msg.sendChannelError( spoiler + '<' + wiki + 'f' + '>' + spoiler );
					
					if ( reaction ) reaction.removeEmoji();
				}
				else if ( body._embedded.threads.length ) {
					var threads = body._embedded.threads;
					var embed = new Discord.RichEmbed().setAuthor( query.general.sitename );
					
					if ( threads.some( thread => thread.id === title ) ) {
						cmd_discussionsend(lang, msg, wiki, threads.find( thread => thread.id === title ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else if ( threads.some( thread => thread.title === title ) ) {
						cmd_discussionsend(lang, msg, wiki, threads.find( thread => thread.title === title ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else if ( threads.some( thread => thread.title.toLowerCase() === title.toLowerCase() ) ) {
						cmd_discussionsend(lang, msg, wiki, threads.find( thread => thread.title.toLowerCase() === title.toLowerCase() ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else if ( threads.some( thread => thread.title.includes( title ) ) ) {
						cmd_discussionsend(lang, msg, wiki, threads.find( thread => thread.title.includes( title ) ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else if ( threads.some( thread => thread.title.toLowerCase().includes( title.toLowerCase() ) ) ) {
						cmd_discussionsend(lang, msg, wiki, threads.find( thread => thread.title.toLowerCase().includes( title.toLowerCase() ) ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else if ( /^\d+$/.test(title) ) {
						request( {
							uri: 'https://services.fandom.com/discussion/' + query.wikidesc.id + '/threads/' + title + '?format=json'
						}, function( therror, thresponse, thbody ) {
							try {
								if ( thbody ) thbody = JSON.parse(thbody);
								if ( therror || !thresponse || thresponse.statusCode !== 200 || !thbody || thbody.id !== title ) {
									if ( thbody && thbody.status === 404 ) {
										if (threads.some( thread => thread.rawContent.toLowerCase().includes( title.toLowerCase() ) ) ) {
											cmd_discussionsend(lang, msg, wiki, threads.find( thread => thread.rawContent.toLowerCase().includes( title.toLowerCase() ) ), embed, spoiler);
										}
										else msg.reactEmoji('🤷');
									}
									else {
										console.log( '- ' + ( thresponse && thresponse.statusCode ) + ': Error while getting the thread: ' + ( therror || thbody && thbody.title ) );
										msg.sendChannelError( spoiler + '<' + wiki + 'f/p/' + title + '>' + spoiler );
									}
								}
								else cmd_discussionsend(lang, msg, wiki, thbody, embed, spoiler);
							}
							catch ( jsonerror ) {
								console.log( '- ' + ( thresponse && thresponse.statusCode ) + ': Error while getting the thread: ' + ( therror || jsonerror ) );
								msg.sendChannelError( spoiler + '<' + wiki + 'f/p/' + title + '>' + spoiler );
							}
							
							if ( reaction ) reaction.removeEmoji();
						} );
					}
					else if ( threads.some( thread => thread.rawContent.toLowerCase().includes( title.toLowerCase() ) ) ) {
						cmd_discussionsend(lang, msg, wiki, threads.find( thread => thread.rawContent.toLowerCase().includes( title.toLowerCase() ) ), embed, spoiler);
						
						if ( reaction ) reaction.removeEmoji();
					}
					else {
						msg.reactEmoji('🤷');
						
						if ( reaction ) reaction.removeEmoji();
					}
				}
				else {
					msg.reactEmoji('🤷');
					
					if ( reaction ) reaction.removeEmoji();
				}
			}
			catch ( jsonerror ) {
				console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the threads: ' + ( error || jsonerror ) );
				msg.sendChannelError( spoiler + '<' + wiki + 'f' + '>' + spoiler );
				
				if ( reaction ) reaction.removeEmoji();
			}
		} );
	}
}

/**
 * Send a link to a discussion
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [wiki] The current wiki
 * @param {Object} [discussion] The discussion
 * @param {Discord.RichEmbed} [embed] The embed
 * @param {String} [spoiler] The pipes if the message is a spoiler
 */
function cmd_discussionsend(lang, msg, wiki, discussion, embed, spoiler) {
	if ( discussion.title ) {
		embed.setTitle( discussion.title.escapeFormatting() );
		var pagelink = wiki + 'f/p/' + ( discussion.threadId || discussion.id );
	}
	else {
		if ( discussion._embedded.thread ) embed.setTitle( discussion._embedded.thread[0].title.escapeFormatting() );
		var pagelink = wiki + 'f/p/' + discussion.threadId + '/r/' + discussion.id;
	}
	var text = '<' + pagelink + '>';
	embed.setURL( pagelink ).setFooter( discussion.createdBy.name, discussion.createdBy.avatarUrl ).setTimestamp( discussion.creationDate.epochSecond * 1000 );
	switch ( discussion.funnel ) {
		case 'TEXT':
			if ( discussion.renderedContent ) {
				var description = '';
				var parser = new htmlparser.Parser( {
					ontext: (htmltext) => {
						description += htmltext.escapeFormatting();
					},
					onclosetag: (tagname) => {
						if ( tagname === 'p' ) description += '\n';
					}
				}, {decodeEntities:true} );
				parser.write( discussion.renderedContent );
				parser.end();
				if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
				embed.setDescription( description );
			}
			break;
		case 'IMAGE':
			embed.setImage( discussion._embedded.contentImages[0].url );
			break;
		case 'POLL':
			discussion.poll.answers.forEach( answer => embed.addField( answer.text.escapeFormatting(), ( lang.discussion.votes[answer.votes] || lang.discussion.votes['*' + answer.votes % 100] || lang.discussion.votes['*' + answer.votes % 10] || lang.discussion.votes.default ).replace( '%s', answer.votes ), true ) );
			break;
		case 'LINK':
			if ( discussion.rawContent.length > 2000 ) embed.setDescription( discussion.rawContent.escapeFormatting().substring(0, 2000) + '\u2026' );
			else if ( discussion.rawContent.length > 1000 ) embed.setDescription( '[' + discussion.rawContent.escapeFormatting().substring(0, 2000 - discussion.rawContent.length) + '\u2026](' + discussion.rawContent.replace( / /g, '_' ).replace( /(\(|\))/g, '\\$1' ) + ')' );
			else embed.setDescription( '[' + discussion.rawContent.escapeFormatting() + '](' + discussion.rawContent.replace( / /g, '_' ).replace( /(\(|\))/g, '\\$1' ) + ')' );
			if ( discussion._embedded.openGraph ) {
				var link = discussion._embedded.openGraph[0];
				embed.setThumbnail( link.imageUrl );
				if ( link.title && link.description ) {
					var name = link.title.escapeFormatting();
					if ( name.length > 250 ) name = name.substring(0, 250) + '\u2026';
					var description = link.description.escapeFormatting();
					if ( description.length > 1000 ) description = description.substring(0, 1000) + '\u2026';
					embed.addField( name, description );
				}
			}
			break;
		case 'QUIZ':
			embed.setDescription( discussion.quiz.title.escapeFormatting() );
			if ( discussion._embedded.openGraph ) embed.setThumbnail( discussion._embedded.openGraph[0].imageUrl );
			break;
		default:
			if ( discussion.renderedContent ) {
				var description = '';
				var parser = new htmlparser.Parser( {
					ontext: (htmltext) => {
						description += htmltext.escapeFormatting();
					},
					onclosetag: (tagname) => {
						if ( tagname === 'p' ) description += '\n';
					}
				}, {decodeEntities:true} );
				parser.write( discussion.renderedContent );
				parser.end();
				if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
				embed.setDescription( description );
			}
			else {
				var description = discussion.rawContent.escapeFormatting();
				if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
				embed.setDescription( description );
			}
			if ( discussion._embedded.contentImages.length ) embed.setImage( discussion._embedded.contentImages[0].url );
	}
	
	msg.sendChannel( spoiler + text + spoiler, embed );
}

/**
 * Get the ids for diffs
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [wiki] The current wiki
 * @param {Discord.MessageReaction} [reaction] The waiting reaction
 * @param {String} [spoiler] The pipes if the message is a spoiler
 */
function cmd_diff(lang, msg, args, wiki, reaction, spoiler) {
	if ( args[0] ) {
		var error = false;
		var title = '';
		var revision = 0;
		var diff = 'prev';
		if ( /^\d+$/.test(args[0]) ) {
			revision = args[0];
			if ( args[1] ) {
				if ( /^\d+$/.test(args[1]) ) {
					diff = args[1];
				}
				else if ( args[1] === 'prev' || args[1] === 'next' ) {
					diff = args[1];
				}
				else error = true;
			}
		}
		else if ( args[0] === 'prev' || args[0] === 'next' ) {
			diff = args[0];
			if ( args[1] ) {
				if ( /^\d+$/.test(args[1]) ) {
					revision = args[1];
				}
				else error = true;
			}
			else error = true;
		}
		else title = args.join(' ');
		
		if ( error ) msg.reactEmoji('error');
		else if ( /^\d+$/.test(diff) ) {
			var argids = [];
			if ( parseInt(revision, 10) > parseInt(diff, 10) ) argids = [revision, diff];
			else if ( parseInt(revision, 10) === parseInt(diff, 10) ) argids = [revision];
			else argids = [diff, revision];
			cmd_diffsend(lang, msg, argids, wiki, reaction, spoiler);
		}
		else {
			request( {
				uri: wiki + 'api.php?action=query&prop=revisions&rvprop=' + ( title ? '&titles=' + encodeURIComponent( title ) : '&revids=' + revision ) + '&rvdiffto=' + diff + '&format=json',
				json: true
			}, function( error, response, body ) {
				if ( body && body.warnings ) log_warn(body.warnings);
				if ( error || !response || response.statusCode !== 200 || !body || !body.query ) {
					if ( response && response.request && response.request.uri && wiki.noWiki(response.request.uri.href) ) {
						console.log( '- This wiki doesn\'t exist!' );
						msg.reactEmoji('nowiki');
					}
					else {
						console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the search results: ' + ( error || body && body.error && body.error.info ) );
						msg.sendChannelError( spoiler + '<' + wiki.toLink() + title.toTitle() + '?diff=' + diff + ( title ? '' : '&oldid=' + revision ) + '>' + spoiler );
					}
					
					if ( reaction ) reaction.removeEmoji();
				}
				else {
					if ( body.query.badrevids ) {
						msg.replyMsg( lang.diff.badrev );
						
						if ( reaction ) reaction.removeEmoji();
					} else if ( body.query.pages && !body.query.pages[-1] ) {
						var revisions = Object.values(body.query.pages)[0].revisions[0];
						if ( revisions.texthidden === undefined ) {
							var argids = [];
							var ids = revisions.diff;
							if ( !ids.from ) argids = [ids.to];
							else {
								argids = [ids.to, ids.from];
								var compare = ['', ''];
								if ( ids['*'] !== undefined ) {
									var more = '\n__' + lang.diff.info.more + '__';
									var current_tag = '';
									var small_prev_ins = '';
									var small_prev_del = '';
									var ins_length = more.length;
									var del_length = more.length;
									var added = false;
									var parser = new htmlparser.Parser( {
										onopentag: (tagname, attribs) => {
											if ( tagname === 'ins' || tagname == 'del' ) {
												current_tag = tagname;
											}
											if ( tagname === 'td' && attribs.class === 'diff-addedline' ) {
												current_tag = tagname+'a';
											}
											if ( tagname === 'td' && attribs.class === 'diff-deletedline' ) {
												current_tag = tagname+"d";
											}
											if ( tagname === 'td' && attribs.class === 'diff-marker' ) {
												added = true;
											}
										},
										ontext: (htmltext) => {
											if ( current_tag === 'ins' && ins_length <= 1000 ) {
												ins_length += ( '**' + htmltext.escapeFormatting() + '**' ).length;
												if ( ins_length <= 1000 ) small_prev_ins += '**' + htmltext.escapeFormatting() + '**';
												else small_prev_ins += more;
											}
											if ( current_tag === 'del' && del_length <= 1000 ) {
												del_length += ( '~~' + htmltext.escapeFormatting() + '~~' ).length;
												if ( del_length <= 1000 ) small_prev_del += '~~' + htmltext.escapeFormatting() + '~~';
												else small_prev_del += more;
											}
											if ( ( current_tag === 'afterins' || current_tag === 'tda') && ins_length <= 1000 ) {
												ins_length += htmltext.escapeFormatting().length;
												if ( ins_length <= 1000 ) small_prev_ins += htmltext.escapeFormatting();
												else small_prev_ins += more;
											}
											if ( ( current_tag === 'afterdel' || current_tag === 'tdd') && del_length <= 1000 ) {
												del_length += htmltext.escapeFormatting().length;
												if ( del_length <= 1000 ) small_prev_del += htmltext.escapeFormatting();
												else small_prev_del += more;
											}
											if ( added ) {
												if ( htmltext === '+' && ins_length <= 1000 ) {
													ins_length++;
													if ( ins_length <= 1000 ) small_prev_ins += '\n';
													else small_prev_ins += more;
												}
												if ( htmltext === '−' && del_length <= 1000 ) {
													del_length++;
													if ( del_length <= 1000 ) small_prev_del += '\n';
													else small_prev_del += more;
												}
												added = false;
											}
										},
										onclosetag: (tagname) => {
											if ( tagname === 'ins' ) {
												current_tag = 'afterins';
											} else if ( tagname === 'del' ) {
												current_tag = 'afterdel';
											} else {
												current_tag = '';
											}
										}
									}, {decodeEntities:true} );
									parser.write( ids['*'] );
									parser.end();
									if ( small_prev_del.length ) {
										if ( small_prev_del.replace( /\~\~/g, '' ).trim().length ) {
											compare[0] = small_prev_del.replace( /\~\~\~\~/g, '' );
										} else compare[0] = '__' + lang.diff.info.whitespace + '__';
									}
									if ( small_prev_ins.length ) {
										if ( small_prev_ins.replace( /\*\*/g, '' ).trim().length ) {
											compare[1] = small_prev_ins.replace( /\*\*\*\*/g, '' );
										} else compare[1] = '__' + lang.diff.info.whitespace + '__';
									}
								}
							}
							cmd_diffsend(lang, msg, argids, wiki, reaction, spoiler, compare);
						} else {
							msg.replyMsg( lang.diff.badrev );
							
							if ( reaction ) reaction.removeEmoji();
						}
					} else {
						if ( body.query.pages && body.query.pages[-1] ) msg.replyMsg( lang.diff.badrev );
						else msg.reactEmoji('error');
						
						if ( reaction ) reaction.removeEmoji();
					}
				}
			} );
		}
	}
	else {
		msg.reactEmoji('error');
		if ( reaction ) reaction.removeEmoji();
	}
}

/**
 * Send information about a diff
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {Number[]} [args] The revision ids
 * @param {String} [wiki] The current wiki
 * @param {Discord.MessageReaction} [reaction] The waiting reaction
 * @param {String} [spoiler] The pipes if the message is a spoiler
 */
function cmd_diffsend(lang, msg, args, wiki, reaction, spoiler, compare) {
	request( {
		uri: wiki + 'api.php?action=query&meta=siteinfo&siprop=general&list=tags&tglimit=500&tgprop=displayname&prop=revisions&rvprop=ids|timestamp|flags|user|size|comment|tags' + ( args.length === 1 || args[0] === args[1] ? '|content' : '' ) + '&revids=' + args.join('|') + '&format=json',
		json: true
	}, function( error, response, body ) {
		if ( body && body.warnings ) log_warn(body.warnings);
		if ( error || !response || response.statusCode !== 200 || !body || !body.query ) {
			if ( response && response.request && response.request.uri && wiki.noWiki(response.request.uri.href) ) {
				console.log( '- This wiki doesn\'t exist!' );
				msg.reactEmoji('nowiki');
			}
			else {
				console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the search results: ' + ( error || body && body.error && body.error.info ) );
				msg.sendChannelError( spoiler + '<' + wiki.toLink() + 'Special:Diff/' + ( args[1] ? args[1] + '/' : '' ) + args[0] + '>' + spoiler );
			}
			
			if ( reaction ) reaction.removeEmoji();
		}
		else {
			if ( body.query.badrevids ) {
				msg.replyMsg( lang.diff.badrev );
				
				if ( reaction ) reaction.removeEmoji();
			}
			else if ( body.query.pages && !body.query.pages['-1'] ) {
				var pages = Object.values(body.query.pages);
				if ( pages.length !== 1 ) {
					msg.sendChannel( spoiler + '<' + wiki.toLink() + 'Special:Diff/' + ( args[1] ? args[1] + '/' : '' ) + args[0] + '>' + spoiler );
					
					if ( reaction ) reaction.removeEmoji();
				}
				else {
					var title = pages[0].title;
					var revisions = pages[0].revisions.sort( (first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp) );
					var diff = revisions[0].revid;
					var oldid = ( revisions[1] ? revisions[1].revid : 0 );
					var editor = [lang.diff.info.editor, ( revisions[0].userhidden !== undefined ? lang.diff.hidden : revisions[0].user )];
					var timestamp = [lang.diff.info.timestamp, new Date(revisions[0].timestamp).toLocaleString(lang.dateformat, timeoptions)];
					var difference = revisions[0].size - ( revisions[1] ? revisions[1].size : 0 );
					var size = [lang.diff.info.size, lang.diff.info.bytes.replace( '%s', ( difference > 0 ? '+' : '' ) + difference )];
					var comment = [lang.diff.info.comment, ( revisions[0].commenthidden !== undefined ? lang.diff.hidden : ( revisions[0].comment ? revisions[0].comment.toFormatting(msg.showEmbed(), wiki, title) : lang.diff.nocomment ) )];
					if ( revisions[0].tags.length ) var tags = [lang.diff.info.tags, body.query.tags.filter( tag => revisions[0].tags.includes( tag.name ) ).map( tag => tag.displayname ).join(', ')];
					
					var pagelink = wiki.toLink() + title.toTitle() + '?diff=' + diff + '&oldid=' + oldid;
					if ( msg.showEmbed() ) {
						var text = '<' + pagelink + '>';
						var editorlink = '[' + editor[1] + '](' + wiki.toLink() + 'User:' + editor[1].toTitle() + ')';
						if ( revisions[0].anon !== undefined ) {
							editorlink = '[' + editor[1] + '](' + wiki.toLink() + 'Special:Contributions/' + editor[1].toTitle(true) + ')';
						}
						if ( editor[1] === lang.diff.hidden ) editorlink = editor[1];
						var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( ( title + '?diff=' + diff + '&oldid=' + oldid ).escapeFormatting() ).setURL( pagelink ).addField( editor[0], editorlink, true ).addField( size[0], size[1], true ).addField( comment[0], comment[1] ).setFooter( timestamp[1] );
						if ( tags ) {
							var taglink = '';
							var tagtext = '';
							var tagparser = new htmlparser.Parser( {
								onopentag: (tagname, attribs) => {
									if ( tagname === 'a' ) taglink = attribs.href;
								},
								ontext: (htmltext) => {
									if ( taglink ) tagtext += '[' + htmltext.escapeFormatting() + '](' + taglink + ')'
									else tagtext += htmltext.escapeFormatting();
								},
								onclosetag: (tagname) => {
									if ( tagname === 'a' ) taglink = '';
								}
							}, {decodeEntities:true} );
							tagparser.write( tags[1] );
							tagparser.end();
							embed.addField( tags[0], tagtext );
						}
						
						var more = '\n__' + lang.diff.info.more + '__';
						if ( !compare && oldid ) request( {
							uri: wiki + 'api.php?action=query&prop=revisions&rvprop=&revids=' + oldid + '&rvdiffto=' + diff + '&format=json',
							json: true
						}, function( cperror, cpresponse, cpbody ) {
							if ( cpbody && cpbody.warnings ) log_warn(cpbody.warnings);
							if ( cperror || !cpresponse || cpresponse.statusCode !== 200 || !cpbody || !cpbody.query || cpbody.query.badrevids || !cpbody.query.pages && cpbody.query.pages[-1] ) {
								console.log( '- ' + ( cpresponse && cpresponse.statusCode ) + ': Error while getting the diff: ' + ( cperror || cpbody && cpbody.error && cpbody.error.info ) );
							}
							else {
								var revision = Object.values(cpbody.query.pages)[0].revisions[0];
								if ( revision.texthidden === undefined && revision.diff && revision.diff['*'] !== undefined ) {
									var current_tag = '';
									var small_prev_ins = '';
									var small_prev_del = '';
									var ins_length = more.length;
									var del_length = more.length;
									var added = false;
									var parser = new htmlparser.Parser( {
										onopentag: (tagname, attribs) => {
											if ( tagname === 'ins' || tagname == 'del' ) {
												current_tag = tagname;
											}
											if ( tagname === 'td' && attribs.class === 'diff-addedline' ) {
												current_tag = tagname+'a';
											}
											if ( tagname === 'td' && attribs.class === 'diff-deletedline' ) {
												current_tag = tagname+"d";
											}
											if ( tagname === 'td' && attribs.class === 'diff-marker' ) {
												added = true;
											}
										},
										ontext: (htmltext) => {
											if ( current_tag === 'ins' && ins_length <= 1000 ) {
												ins_length += ( '**' + htmltext.escapeFormatting() + '**' ).length;
												if ( ins_length <= 1000 ) small_prev_ins += '**' + htmltext.escapeFormatting() + '**';
												else small_prev_ins += more;
											}
											if ( current_tag === 'del' && del_length <= 1000 ) {
												del_length += ( '~~' + htmltext.escapeFormatting() + '~~' ).length;
												if ( del_length <= 1000 ) small_prev_del += '~~' + htmltext.escapeFormatting() + '~~';
												else small_prev_del += more;
											}
											if ( ( current_tag === 'afterins' || current_tag === 'tda') && ins_length <= 1000 ) {
												ins_length += htmltext.escapeFormatting().length;
												if ( ins_length <= 1000 ) small_prev_ins += htmltext.escapeFormatting();
												else small_prev_ins += more;
											}
											if ( ( current_tag === 'afterdel' || current_tag === 'tdd') && del_length <= 1000 ) {
												del_length += htmltext.escapeFormatting().length;
												if ( del_length <= 1000 ) small_prev_del += htmltext.escapeFormatting();
												else small_prev_del += more;
											}
											if ( added ) {
												if ( htmltext === '+' && ins_length <= 1000 ) {
													ins_length++;
													if ( ins_length <= 1000 ) small_prev_ins += '\n';
													else small_prev_ins += more;
												}
												if ( htmltext === '−' && del_length <= 1000 ) {
													del_length++;
													if ( del_length <= 1000 ) small_prev_del += '\n';
													else small_prev_del += more;
												}
												added = false;
											}
										},
										onclosetag: (tagname) => {
											if ( tagname === 'ins' ) {
												current_tag = 'afterins';
											} else if ( tagname === 'del' ) {
												current_tag = 'afterdel';
											} else {
												current_tag = '';
											}
										}
									}, {decodeEntities:true} );
									parser.write( revision.diff['*'] );
									parser.end();
									if ( small_prev_del.length ) {
										if ( small_prev_del.replace( /\~\~/g, '' ).trim().length ) {
											embed.addField( lang.diff.info.removed, small_prev_del.replace( /\~\~\~\~/g, '' ), true );
										} else embed.addField( lang.diff.info.removed, '__' + lang.diff.info.whitespace + '__', true );
									}
									if ( small_prev_ins.length ) {
										if ( small_prev_ins.replace( /\*\*/g, '' ).trim().length ) {
											embed.addField( lang.diff.info.added, small_prev_ins.replace( /\*\*\*\*/g, '' ), true );
										} else embed.addField( lang.diff.info.added, '__' + lang.diff.info.whitespace + '__', true );
									}
								}
								else if ( revision.texthidden !== undefined ) {
									embed.addField( lang.diff.info.added, '__' + lang.diff.hidden + '__', true );
								}
								else if ( revision.diff && revision.diff['*'] === undefined ) {
									embed.addField( lang.diff.info.removed, '__' + lang.diff.hidden + '__', true );
								}
							}
							
							msg.sendChannel( spoiler + text + spoiler, embed );
							
							if ( reaction ) reaction.removeEmoji();
						} );
						else {
							if ( compare ) {
								if ( compare[0].length ) embed.addField( lang.diff.info.removed, compare[0], true );
								if ( compare[1].length ) embed.addField( lang.diff.info.added, compare[1], true );
							}
							else if ( revisions[0]['*'] ) {
								var content = revisions[0]['*'].escapeFormatting();
								if ( content.trim().length ) {
									if ( content.length <= 1000 ) content = '**' + content + '**';
									else {
										content = content.substring(0, 1000 - more.length);
										content = '**' + content.substring(0, content.lastIndexOf('\n')) + '**' + more;
									}
									embed.addField( lang.diff.info.added, content, true );
								} else embed.addField( lang.diff.info.added, '__' + lang.diff.info.whitespace + '__', true );
							}
							
							msg.sendChannel( spoiler + text + spoiler, embed );
							
							if ( reaction ) reaction.removeEmoji();
						}
					}
					else {
						var embed = {};
						var text = '<' + pagelink + '>\n\n' + editor.join(' ') + '\n' + timestamp.join(' ') + '\n' + size.join(' ') + '\n' + comment.join(' ');
						if ( tags ) {
							var tagparser = new htmlparser.Parser( {
								ontext: (htmltext) => {
									text += htmltext.escapeFormatting();
								}
							}, {decodeEntities:true} );
							tagparser.write( '\n' + tags.join(' ') );
							tagparser.end();
						}
						
						msg.sendChannel( spoiler + text + spoiler, embed );
						
						if ( reaction ) reaction.removeEmoji();
					}
				}
			}
			else {
				msg.reactEmoji('error');
				
				if ( reaction ) reaction.removeEmoji();
			}
		}
		
		if ( reaction ) reaction.removeEmoji();
	} );
}

/**
 * Send a link to a random wiki page
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [wiki] The current wiki
 * @param {Discord.MessageReaction} [reaction] The waiting reaction
 * @param {String} [spoiler] The pipes if the message is a spoiler
 */
function cmd_random(lang, msg, wiki, reaction, spoiler) {
	request( {
		uri: wiki + 'api.php?action=query&meta=allmessages|siteinfo&ammessages=description&siprop=general&generator=random&grnnamespace=0&format=json',
		json: true
	}, function( error, response, body ) {
		if ( body && body.warnings ) log_warn(body.warnings);
		if ( error || !response || response.statusCode !== 200 || !body || !body.query || !body.query.pages ) {
			if ( response && response.request && response.request.uri && wiki.noWiki(response.request.uri.href) ) {
				console.log( '- This wiki doesn\'t exist!' );
				msg.reactEmoji('nowiki');
			}
			else {
				console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the search results: ' + ( error || body && body.error && body.error.info ) );
				msg.sendChannelError( spoiler + '<' + wiki.toLink() + 'Special:Random>' + spoiler );
			}
			
			if ( reaction ) reaction.removeEmoji();
		}
		else {
			querypage = Object.values(body.query.pages)[0];
			var pagelink = wiki.toLink() + querypage.title.toTitle();
			var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( querypage.title.escapeFormatting() ).setURL( pagelink );
			if ( querypage.title === body.query.general.mainpage && body.query.allmessages[0]['*'] ) {
				embed.setDescription( body.query.allmessages[0]['*'] );
				embed.setThumbnail( wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png' );
				
				msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, embed );
				
				if ( reaction ) reaction.removeEmoji();
			}
			else request( {
				uri: wiki.toLink() + encodeURIComponent( querypage.title.replace( / /g, '_' ) )
			}, function( descerror, descresponse, descbody ) {
				if ( descerror || !descresponse || descresponse.statusCode !== 200 || !descbody ) {
					console.log( '- ' + ( descresponse && descresponse.statusCode ) + ': Error while getting the description: ' + descerror );
				} else {
					var thumbnail = wiki.toLink() + 'Special:FilePath/Wiki-wordmark.png';
					var parser = new htmlparser.Parser( {
						onopentag: (tagname, attribs) => {
							if ( tagname === 'meta' && attribs.property === 'og:description' ) {
								var description = attribs.content.escapeFormatting();
								if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
								embed.setDescription( description );
							}
							if ( tagname === 'meta' && attribs.property === 'og:image' && querypage.title !== body.query.general.mainpage ) {
								thumbnail = attribs.content;
							}
						}
					}, {decodeEntities:true} );
					parser.write( descbody );
					parser.end();
					embed.setThumbnail( thumbnail );
				}
				
				msg.sendChannel( '🎲 ' + spoiler + '<' + pagelink + '>' + spoiler, embed );
				
				if ( reaction ) reaction.removeEmoji();
			} );
		}
	} );
}

/**
 * Send a overview of a wiki with some statistics
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String} [wiki] The current wiki
 * @param {Discord.MessageReaction} [reaction] The waiting reaction
 * @param {String} [spoiler] The pipes if the message is a spoiler
 */
function cmd_overview(lang, msg, wiki, reaction, spoiler) {
	request( {
		uri: wiki + 'api.php?action=query&meta=siteinfo&siprop=general|statistics|wikidesc&titles=Special:Statistics&format=json',
		json: true
	}, function( error, response, body ) {
		if ( body && body.warnings ) log_warn(body.warnings);
		if ( error || !response || response.statusCode !== 200 || !body || !body.query || !body.query.pages ) {
			if ( response && response.request && response.request.uri && wiki.noWiki(response.request.uri.href) ) {
				console.log( '- This wiki doesn\'t exist!' );
				msg.reactEmoji('nowiki');
			}
			else {
				console.log( '- ' + ( response && response.statusCode ) + ': Error while getting the search results: ' + ( error || body && body.error && body.error.info ) );
				msg.sendChannelError( spoiler + '<' + wiki.toLink() + 'Special:Statistics>' + spoiler );
			}
			
			if ( reaction ) reaction.removeEmoji();
		}
		else request( {
			uri: 'https://community.fandom.com/api/v1/Wikis/Details?ids=' + body.query.wikidesc.id + '&format=json',
			json: true
		}, function( overror, ovresponse, ovbody ) {
			if ( overror || !ovresponse || ovresponse.statusCode !== 200 || !ovbody || ovbody.exception || !ovbody.items || !ovbody.items[body.query.wikidesc.id] ) {
				console.log( '- ' + ( ovresponse && ovresponse.statusCode ) + ': Error while getting the wiki details: ' + ( overror || ovbody && ovbody.exception && ovbody.exception.details ) );
				msg.sendChannelError( spoiler + '<' + wiki.toLink() + 'Special:Statistics>' + spoiler );
				
				if ( reaction ) reaction.removeEmoji();
			}
			else {
				var site = ovbody.items[body.query.wikidesc.id];
				
				var vertical = [lang.overview.vertical, site.hub];
				var topic = [lang.overview.topic, site.topic];
				var founder = [lang.overview.founder, site.founding_user_id];
				var created = [lang.overview.created, new Date(site.creation_date).toLocaleString(lang.dateformat, timeoptions)];
				var articles = [lang.overview.articles, body.query.statistics.articles];
				var pages = [lang.overview.pages, body.query.statistics.pages];
				var edits = [lang.overview.edits, body.query.statistics.edits];
				var users = [lang.overview.users, body.query.statistics.activeusers];
				
				var title = body.query.pages['-1'].title;
				var pagelink = wiki.toLink() + title.toTitle();
				if ( msg.showEmbed() ) {
					var text = '<' + pagelink + '>';
					var embed = new Discord.RichEmbed().setAuthor( body.query.general.sitename ).setTitle( title.escapeFormatting() ).setURL( pagelink ).setThumbnail( site.wordmark ).addField( vertical[0], vertical[1], true ).addField( topic[0], topic[1], true );
				}
				else {
					var embed = {};
					var text = '<' + pagelink + '>\n\n' + vertical.join(' ') + '\n' + topic.join(' ');
				}
				
				if ( founder[1] !== "0" ) request( {
					uri: wiki + 'api.php?action=query&list=users&usprop=&usids=' + founder[1] + '&format=json',
					json: true
				}, function( userror, usresponse, usbody ) {
					if ( usbody && usbody.warnings ) log_warn(usbody.warnings);
					if ( userror || !usresponse || usresponse.statusCode !== 200 || !usbody || !usbody.query || !usbody.query.users || !usbody.query.users[0] ) {
						console.log( '- ' + ( usresponse && usresponse.statusCode ) + ': Error while getting the wiki founder: ' + ( userror || usbody && usbody.error && usbody.error.info ) );
						founder[1] = 'ID: ' + founder[1];
					}
					else {
						var user = usbody.query.users[0].name;
						if ( msg.showEmbed() ) founder[1] = '[' + user + '](' + wiki.toLink() + 'User:' + user.toTitle(true) + ')';
						else founder[1] = user;
					}
					
					if ( msg.showEmbed() ) embed.addField( founder[0], founder[1], true ).addField( created[0], created[1], true ).addField( articles[0], articles[1], true ).addField( pages[0], pages[1], true ).addField( edits[0], edits[1], true ).addField( users[0], users[1], true ).setFooter( lang.overview.inaccurate );
					else text += '\n' + founder.join(' ') + '\n' + created.join(' ') + '\n' + articles.join(' ') + '\n' + pages.join(' ') + '\n' + edits.join(' ') + '\n' + users.join(' ') + '\n\n*' + lang.overview.inaccurate + '*';
					
					msg.sendChannel( spoiler + text + spoiler, embed );
					
					if ( reaction ) reaction.removeEmoji();
				} );
				else {
					founder[1] = lang.overview.none;
					if ( msg.showEmbed() ) embed.addField( founder[0], founder[1], true ).addField( created[0], created[1], true ).addField( articles[0], articles[1], true ).addField( pages[0], pages[1], true ).addField( edits[0], edits[1], true ).addField( users[0], users[1], true ).setFooter( lang.overview.inaccurate );
					else text += '\n' + founder.join(' ') + '\n' + created.join(' ') + '\n' + articles.join(' ') + '\n' + pages.join(' ') + '\n' + edits.join(' ') + '\n' + users.join(' ') + '\n\n*' + lang.overview.inaccurate + '*';
					
					msg.sendChannel( spoiler + text + spoiler, embed );
					
					if ( reaction ) reaction.removeEmoji();
				}
			}
		} );
	} );
}

/**
 * Show an error for commands that need to use the full message
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_multiline(lang, msg, args, line) {
	if ( msg.channel.type !== 'text' || !pause[msg.guild.id] ) {
		if ( msg.isAdmin() ) msg.reactEmoji('error', true);
		else msg.reactEmoji('❌');
	}
}

/**
 * Show how to use the voice channel feature
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_voice(lang, msg, args, line) {
	if ( msg.isAdmin() && !args.join('') ) msg.replyMsg( lang.voice.text + '\n`' + lang.voice.channel + ' – <' + lang.voice.name + '>`' );
	else cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
}

/**
 * Get information about a guild, user or channel
 * @param {Object} [lang] The language for this guild
 * @param {Discord.Message} [msg] The message
 * @param {String[]} [args] The arguments
 * @param {String} [line] The full line of the message
 */
function cmd_get(lang, msg, args, line) {
	var id = args.join().replace( /^\\?<(?:@!?|#)(\d+)>$/, '$1' );
	if ( /^\d+$/.test(id) ) {
		if ( client.guilds.has(id) ) {
			var guild = client.guilds.get(id);
			var guildname = ['Guild:', guild.name.escapeFormatting() + ' `' + guild.id + '`' + ( pause[guild.id] ? '\\*' : '' )];
			var guildowner = ['Owner:', guild.owner.user.tag.escapeFormatting() + ' `' + guild.ownerID + '` ' + guild.owner.toString()];
			var guildsize = ['Size:', guild.memberCount + ' members (' + guild.members.filter( member => member.user.bot ).size + ' bots)'];
			var guildpermissions = ['Missing permissions:', ( guild.me.permissions.has(defaultPermissions) ? '*none*' : '`' + guild.me.permissions.missing(defaultPermissions).join('`, `') + '`' )];
			var guildsettings = ['Settings:', ( guild.id in settings ? '```json\n' + JSON.stringify( settings[guild.id], null, '\t' ) + '\n```' : '*default*' )];
			if ( msg.showEmbed() ) {
				var text = '';
				var embed = new Discord.RichEmbed().addField( guildname[0], guildname[1] ).addField( guildowner[0], guildowner[1] ).addField( guildsize[0], guildsize[1] ).addField( guildpermissions[0], guildpermissions[1] );
				var split = Discord.Util.splitMessage( guildsettings[1], {maxLength:1000,prepend:'```json\n{',append:'\n```'} );
				if ( split.length < guildsettings[1].length ) split.forEach( guildsettingspart => embed.addField( guildsettings[0], guildsettingspart ) );
				else embed.addField( guildsettings[0], split );
			}
			else {
				var embed = {};
				var text = guildname.join(' ') + '\n' + guildowner.join(' ') + '\n' + guildsize.join(' ') + '\n' + guildpermissions.join(' ') + '\n' + guildsettings.join(' ');
			}
			msg.sendChannel( text, {embed,split:{prepend:'```json\n{',append:'\n```'}}, true );
		} else if ( client.guilds.some( guild => guild.members.has(id) ) ) {
			var username = [];
			var guildlist = ['Guilds:'];
			var guilds = client.guilds.filter( guild => guild.members.has(id) );
			guildlist.push('\n' + guilds.map( function(guild) {
				var member = guild.members.get(id);
				if ( !username.length ) username.push('User:', member.user.tag.escapeFormatting() + ' `' + member.id + '` ' + member.toString());
				return guild.name.escapeFormatting() + ' `' + guild.id + '`' + ( member.permissions.has('MANAGE_GUILD') ? '\\*' : '' );
			} ).join('\n'));
			if ( guildlist[1].length > 1000 ) guildlist[1] = guilds.size;
			if ( msg.showEmbed() ) {
				var text = '';
				var embed = new Discord.RichEmbed().addField( username[0], username[1] ).addField( guildlist[0], guildlist[1] );
			}
			else {
				var embed = {};
				var text = username.join(' ') + '\n' + guildlist.join(' ');
			}
			msg.sendChannel( text, embed, true );
		} else if ( client.guilds.some( guild => guild.channels.filter( chat => chat.type === 'text' ).has(id) ) ) {
			var channel = client.guilds.find( guild => guild.channels.filter( chat => chat.type === 'text' ).has(id) ).channels.get(id);
			var channelguild = ['Guild:', channel.guild.name.escapeFormatting() + ' `' + channel.guild.id + '`' + ( pause[channel.guild.id] ? '\\*' : '' )];
			var channelname = ['Channel:', '#' + channel.name.escapeFormatting() + ' `' + channel.id + '` ' + channel.toString()];
			var channelpermissions = ['Missing permissions:', ( channel.memberPermissions(channel.guild.me).has(defaultPermissions) ? '*none*' : '`' + channel.memberPermissions(channel.guild.me).missing(defaultPermissions).join('`, `') + '`' )];
			var channelwiki = ['Default Wiki:', channel.getWiki()];
			if ( msg.showEmbed() ) {
				var text = '';
				var embed = new Discord.RichEmbed().addField( channelguild[0], channelguild[1] ).addField( channelname[0], channelname[1] ).addField( channelpermissions[0], channelpermissions[1] ).addField( channelwiki[0], channelwiki[1] );
			}
			else {
				var embed = {};
				var text = channelguild.join(' ') + '\n' + channelname.join(' ') + '\n' + channelpermissions.join(' ') + '\n' + channelwiki[0] + ' <' + channelwiki[1] + '>';
			}
			msg.sendChannel( text, embed, true );
		} else msg.replyMsg( 'I couldn\'t find a result for `' + id + '`', {}, true );
	} else if ( msg.channel.type !== 'text' || !pause[msg.guild.id] ) cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
}

/**
 * Check if the wiki does not exist
 * @param {String} [href] The link
 * @returns {Boolean}
 */
String.prototype.noWiki = function(href) {
	if ( !href ) return false;
	else return [
		this.replace( /^https:\/\/([a-z\d-]{1,50}\.(?:fandom\.com|wikia\.org))\/(?:[a-z-]{1,8}\/)?$/, 'https://community.fandom.com/wiki/Community_Central:Not_a_valid_community?from=$1' ),
		this + 'language-wikis'
	].includes( href );
};

/**
 * Create url for wiki article
 * @returns {String}
 */
String.prototype.toLink = function() {
	return this + 'wiki/';
};

/**
 * If string is a mention
 * @param {Discord.Guild} [guild] The guild the message is from
 * @returns {Boolean}
 */
String.prototype.isMention = function(guild) {
	var text = this.trim();
	return text === '@' + client.user.username || text.replace( /^<@!?(\d+)>$/, '$1' ) === client.user.id || ( guild && text === '@' + guild.me.displayName );
};

/**
 * Get default wiki for the channel
 * @returns {String}
 */
Discord.Channel.prototype.getWiki = function() {
	if ( this.type === 'text' && this.guild.id in settings ) {
		if ( settings[this.guild.id].channels && this.id in settings[this.guild.id].channels ) return settings[this.guild.id].channels[this.id];
		else return settings[this.guild.id].wiki;
	}
	else return settings.default.wiki;
};

/**
 * If message send by admin
 * @returns {Boolean}
 */
Discord.Message.prototype.isAdmin = function() {
	return this.channel.type === 'text' && this.member && this.member.permissions.has('MANAGE_GUILD');
};

/**
 * If message send by bot owner
 * @returns {Boolean}
 */
Discord.Message.prototype.isOwner = function() {
	return this.author.id === process.env.owner;
};

/**
 * If bot can use embeds
 * @returns {Boolean}
 */
Discord.Message.prototype.showEmbed = function() {
	return this.channel.type !== 'text' || this.channel.permissionsFor(client.user).has('EMBED_LINKS');
};


/**
 * If bot can upload files
 * @returns {Boolean}
 */
Discord.Message.prototype.uploadFiles = function() {
	return this.channel.type !== 'text' || this.channel.permissionsFor(client.user).has('ATTACH_FILES');
};

/**
 * Convert custom emotes
 * @returns {String[]}
 */
Array.prototype.toEmojis = function() {
	var text = this.join(' ');
	var regex = /(<a?:)(\d+)(>)/g;
	if ( regex.test(text) ) {
		regex.lastIndex = 0;
		var emojis = client.emojis;
		while ( ( entry = regex.exec(text) ) !== null ) {
			if ( emojis.has(entry[2]) ) {
				text = text.replaceSave(entry[0], emojis.get(entry[2]).toString());
			} else {
				text = text.replaceSave(entry[0], entry[1] + 'unknown_emoji:' + entry[2] + entry[3]);
			}
		}
		return text.split(' ');
	}
	else return this;
};

/**
 * Format string for links
 * @param {Boolean} [isMarkdown=false] If the link is used in markdown formatting
 * @returns {String}
 */
String.prototype.toTitle = function(isMarkdown = false) {
	var title = this.replace( / /g, '_' ).replace( /\%/g, '%25' ).replace( /\?/g, '%3F' ).replace( /@(here|everyone)/g, '%40$1' );
	if ( isMarkdown ) title = title.replace( /(\(|\))/g, '\\$1' );
	return title;
};

/**
 * Format string for search query
 * @returns {String}
 */
String.prototype.toSearch = function() {
	return encodeURIComponent( this ).replace( /%20/g, '+' );
};

/**
 * Format string for section links
 * @returns {String}
 */
String.prototype.toSection = function() {
	return encodeURIComponent( this.replace( / /g, '_' ) ).replace( /\'/g, '%27' ).replace( /\(/g, '%28' ).replace( /\)/g, '%29' ).replace( /\%/g, '.' );
};

/**
 * Convert wiki code to formatted text
 * @param {Boolean} [showEmbed=false] If an embed can be used
 * @param {String[]} [args] Arguments for the formatting function
 * @returns {String}
 */
String.prototype.toFormatting = function(showEmbed = false, ...args) {
	if ( showEmbed ) return this.toMarkdown(...args);
	else return this.toPlaintext();
};

/**
 * Convert wiki code to markdown text
 * @param {String} [wiki] The current wiki
 * @param {String} [title=''] The title of the current page
 * @returns {String}
 */
String.prototype.toMarkdown = function(wiki, title = '') {
	var text = this;
	while ( ( link = /\[\[(?:([^\|\]]+)\|)?([^\]]+)\]\]([a-z]*)/g.exec(text) ) !== null ) {
		if ( link[1] ) {
			var page = ( /^(#|\/)/.test(link[1]) ? title.toTitle(true) + ( /^#/.test(link[1]) ? '#' + link[1].substring(1).toSection() : link[1].toTitle(true) ) : link[1].toTitle(true) );
			text = text.replaceSave( link[0], '[' + link[2] + link[3] + '](' + wiki.toLink() + page + ')' );
		} else {
			var page = ( /^(#|\/)/.test(link[2]) ? title.toTitle(true) + ( /^#/.test(link[2]) ? '#' + link[2].substring(1).toSection() : link[2].toTitle(true) ) : link[2].toTitle(true) );
			text = text.replaceSave( link[0], '[' + link[2] + link[3] + '](' + wiki.toLink() + page + ')' );
		}
	}
	while ( title !== '' && ( link = /\/\*\s*([^\*]+?)\s*\*\/\s*(.)?/g.exec(text) ) !== null ) {
		var page = title.toTitle(true) + '#' + link[1].toSection();
		text = text.replaceSave( link[0], '[→](' + wiki.toLink() + page + ')' + link[1] + ( link[2] ? ': ' + link[2] : '' ) );
	}
	return text.escapeFormatting();
};

/**
 * Convert wiki code to plain text
 * @returns {String}
 */
String.prototype.toPlaintext = function() {
	return this.replace( /\[\[(?:[^\|\]]+\|)?([^\]]+)\]\]/g, '$1' ).replace( /\/\*\s*([^\*]+?)\s*\*\//g, '→$1:' ).escapeFormatting();
};

/**
 * Escape all characters used for formatting
 * @returns {String}
 */
String.prototype.escapeFormatting = function() {
	return this.replace( /(`|_|\*|~|:|<|>|{|}|@|\||\\|\/\/)/g, '\\$1' );
};

/**
 * Replace with escaped $
 * @param {string|RegExp} [pattern] Pattern to replace
 * @param {string|function} [replacement] Replacement for the pattern
 * @returns {string}
 */
String.prototype.replaceSave = function(pattern, replacement) {
	return this.replace( pattern, ( typeof replacement === 'string' ? replacement.replace( '$', '$$$$' ) : replacement ) );
};

/**
 * Add a reaction to the message
 * @param {string|Discord.Emoji|Discord.ReactionEmoji} [name] The emoji to react with
 * @param {Boolean} [ignorePause=false] If message should be send while paused
 * @returns {Promise<Discord.MessageReaction>}
 */
Discord.Message.prototype.reactEmoji = function(name, ignorePause = false) {
	if ( this.channel.type !== 'text' || !pause[this.guild.id] || ( ignorePause && ( this.isAdmin() || this.isOwner() ) ) ) {
		var emoji = '440871715938238494';
		switch ( name ) {
			case 'nowiki':
				emoji = '505884572001763348';
				break;
			case 'error':
				emoji = '440871715938238494';
				break;
			case 'support':
				emoji = '448222377009086465';
				break;
			case 'oppose':
				emoji = '448222455425794059';
				break;
			default:
				emoji = name;
		}
		return this.react(emoji).catch(log_error);
	} else {
		console.log( '- Aborted, paused.' );
		return Promise.resolve();
	}
};

/**
 * Remove this reaction
 * @returns {Promise<Discord.MessageReaction>}
 */
Discord.MessageReaction.prototype.removeEmoji = function() {
	return this.remove().catch(log_error);
};

/**
 * Send another message to the channel of the message
 * @param {StringResolvable} [content] Text for the message
 * @param {Discord.MessageOptions|Discord.Attachment|Discord.RichEmbed} [options] Options for the message, can also be just a RichEmbed or Attachment
 * @param {Boolean} [ignorePause=false] If message should be send while paused
 * @returns {Promise<Discord.Message|Discord.Message[]>}
 */
Discord.Message.prototype.sendChannel = function(content, options, ignorePause = false) {
	if ( this.channel.type !== 'text' || !pause[this.guild.id] || ( ignorePause && ( this.isAdmin() || this.isOwner() ) ) ) {
		return this.channel.send(content, options).then( msg => {
			if ( msg.length ) msg.forEach( message => message.allowDelete(this.author.id) );
			else msg.allowDelete(this.author.id);
			return msg;
		}, log_error );
	} else {
		console.log( '- Aborted, paused.' );
		return Promise.resolve();
	}
};

/**
 * Send another message to the channel of this message and react with error
 * @param {StringResolvable} [content] Text for the message
 * @param {Discord.MessageOptions|Discord.Attachment|Discord.RichEmbed} [options] Options for the message, can also be just a RichEmbed or Attachment
 * @returns {Promise<Discord.Message|Discord.Message[]>}
 */
Discord.Message.prototype.sendChannelError = function(content, options) {
	return this.channel.send(content, options).then( msg => {
		if ( msg.length ) msg.forEach( message => {
			message.reactEmoji('error');
			message.allowDelete(this.author.id);
		} );
		else {
			msg.reactEmoji('error');
			msg.allowDelete(this.author.id);
		}
		return msg;
	}, log_error );
};

/**
 * Reply to the message
 * @param {StringResolvable} [content] The content for the message
 * @param {Discord.MessageOptions} [options] The options to provide
 * @param {Boolean} [ignorePause=false] If message should be send while paused
 * @returns {Promise<Discord.Message|Discord.Message[]>}
 */
Discord.Message.prototype.replyMsg = function(content, options, ignorePause = false) {
	if ( this.channel.type !== 'text' || !pause[this.guild.id] || ( ignorePause && ( this.isAdmin() || this.isOwner() ) ) ) {
		return this.reply(content, options).then( msg => {
			if ( msg.length ) msg.forEach( message => message.allowDelete(this.author.id) );
			else msg.allowDelete(this.author.id);
			return msg;
		}, log_error );
	} else {
		console.log( '- Aborted, paused.' );
		return Promise.resolve();
	}
};

/**
 * Deletes the message
 * @param {Number} [timeout=0] How long to wait to delete the message in milliseconds
 * @returns {Promise<Discord.Message>}
 */
Discord.Message.prototype.deleteMsg = function(timeout = 0) {
	return this.delete(timeout).catch(log_error);
};

/**
 * Waits for reaction to delete the message
 * @param {String} [author] Snowflake of the user who can delete the message
 * @returns {Promise<Discord.Message>}
 */
Discord.Message.prototype.allowDelete = function(author) {
	return this.awaitReactions( (reaction, user) => reaction.emoji.name === '🗑' && user.id === author, {max:1,time:30000} ).then( reaction => {
		if ( reaction.size ) {
			this.deleteMsg();
		}
	} );
};

/**
 * Check if the test has the command prefix
 * @param {String} [flags=''] The flags for the RegExp
 * @returns {Boolean}
 */
String.prototype.hasPrefix = function(flags = '') {
	return RegExp( '^' + process.env.prefix + '(?: |$)', flags ).test(this.replace(/\u200b/g, '').toLowerCase());
};

client.on( 'message', msg => {
	if ( stop || msg.type !== 'DEFAULT' || !msg.content.hasPrefix('m') || msg.webhookID || msg.author.id === client.user.id ) return;
	
	var cont = msg.content;
	var author = msg.author;
	var channel = msg.channel;
	if ( channel.type === 'text' ) var permissions = channel.permissionsFor(client.user);
	
	if ( !ready.settings && settings === defaultSettings ) getSettings();
	if ( settings === defaultSettings ) {
		msg.sendChannel( '⚠ **Limited Functionality** ⚠\nNo settings found, please contact the bot owner!\n' + process.env.invite, {}, true );
	}
	var lang = i18n[( channel.type === 'text' && settings[msg.guild.id] || settings.default ).lang];
	
	if ( channel.type !== 'text' || permissions.has(['SEND_MESSAGES','ADD_REACTIONS','USE_EXTERNAL_EMOJIS','READ_MESSAGE_HISTORY']) ) {
		var invoke = ( cont.split(' ')[1] ? cont.split(' ')[1].split('\n')[0].toLowerCase() : '' );
		var aliasInvoke = ( lang.aliase[invoke] || invoke );
		var ownercmd = ( msg.isOwner() && aliasInvoke in ownercmdmap );
		if ( cont.hasPrefix() && ( ( msg.isAdmin() && aliasInvoke in multilinecmdmap ) || ownercmd ) ) {
			if ( ownercmd || permissions.has('MANAGE_MESSAGES') ) {
				var args = cont.split(' ').slice(2);
				if ( cont.split(' ')[1].split('\n')[1] ) args.unshift( '', cont.split(' ')[1].split('\n')[1] );
				if ( !( ownercmd || aliasInvoke in pausecmdmap ) && pause[msg.guild.id] ) console.log( msg.guild.name + ': Paused' );
				else console.log( ( msg.guild ? msg.guild.name : '@' + author.username ) + ': ' + cont );
				if ( ownercmd ) ownercmdmap[aliasInvoke](lang, msg, args, cont);
				else if ( !pause[msg.guild.id] || aliasInvoke in pausecmdmap ) multilinecmdmap[aliasInvoke](lang, msg, args, cont);
			} else {
				console.log( msg.guild.name + ': Missing permissions - MANAGE_MESSAGES' );
				msg.replyMsg( lang.missingperm + ' `MANAGE_MESSAGES`' );
			}
		} else {
			var count = 0;
			msg.cleanContent.replace(/\u200b/g, '').split('\n').forEach( function(line) {
				if ( line.hasPrefix() && count < 10 ) {
					count++;
					invoke = ( line.split(' ')[1] ? line.split(' ')[1].toLowerCase() : '' );
					var args = line.split(' ').slice(2);
					aliasInvoke = ( lang.aliase[invoke] || invoke );
					ownercmd = ( msg.isOwner() && aliasInvoke in ownercmdmap );
					if ( channel.type === 'text' && pause[msg.guild.id] && !( ( msg.isAdmin() && aliasInvoke in pausecmdmap ) || ownercmd ) ) console.log( msg.guild.name + ': Paused' );
					else console.log( ( msg.guild ? msg.guild.name : '@' + author.username ) + ': ' + line );
					if ( ownercmd ) ownercmdmap[aliasInvoke](lang, msg, args, line);
					else if ( channel.type !== 'text' || !pause[msg.guild.id] || ( msg.isAdmin() && aliasInvoke in pausecmdmap ) ) {
						if ( aliasInvoke in cmdmap ) cmdmap[aliasInvoke](lang, msg, args, line);
						else if ( /^!(?:[a-z-]{1,8}\.)?[a-z\d-]{1,50}$/.test(invoke) ) {
							if ( invoke.includes( '.' ) ) wiki = 'https://' + invoke.split('.')[1] + '.fandom.com/' + invoke.substring(1).split('.')[0] + '/';
							else wiki = 'https://' + invoke.substring(1) + '.fandom.com/';
							cmd_link(lang, msg, args.join(' '), wiki, ' ' + invoke + ' ');
						}
						else if ( /^\?(?:[a-z-]{1,8}\.)?[a-z\d-]{1,50}$/.test(invoke) ) {
							if ( invoke.includes( '.' ) ) wiki = 'https://' + invoke.split('.')[1] + '.wikia.org/' + invoke.substring(1).split('.')[0] + '/';
							else wiki = 'https://' + invoke.substring(1) + '.wikia.org/';
							cmd_link(lang, msg, args.join(' '), wiki, ' ' + invoke + ' ');
						}
						else cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
					}
				} else if ( line.hasPrefix() && count === 10 ) {
					count++;
					console.log( '- Message contains too many commands!' );
					msg.reactEmoji('⚠');
					msg.sendChannelError( lang.limit.replaceSave( '%s', author ) );
				}
			} );
		}
	} else if ( msg.isAdmin() || msg.isOwner() ) {
		var missing = permissions.missing(['SEND_MESSAGES','ADD_REACTIONS','USE_EXTERNAL_EMOJIS','READ_MESSAGE_HISTORY']);
		console.log( msg.guild.name + ': Missing permissions - ' + missing.join(', ') );
		if ( !missing.includes( 'SEND_MESSAGES' ) ) msg.replyMsg( lang.missingperm + ' `' + missing.join('`, `') + '`' );
	}
} );


client.on( 'voiceStateUpdate', (oldm, newm) => {
	if ( stop ) return;
	
	if ( !ready.settings && settings === defaultSettings ) getSettings();
	if ( oldm.guild.me.permissions.has('MANAGE_ROLES') && oldm.voiceChannelID !== newm.voiceChannelID ) {
		var lang = i18n[( settings[oldm.guild.id] || settings.default ).lang].voice;
		if ( oldm.voiceChannel ) {
			var oldrole = oldm.roles.find( role => role.name === lang.channel + ' – ' + oldm.voiceChannel.name );
			if ( oldrole && oldrole.comparePositionTo(oldm.guild.me.highestRole) < 0 ) {
				console.log( oldm.guild.name + ': ' + oldm.displayName + ' left the voice channel "' + oldm.voiceChannel.name + '".' );
				oldm.removeRole( oldrole, lang.left.replaceSave( '%1$s', oldm.displayName ).replaceSave( '%2$s', oldm.voiceChannel.name ) ).catch(log_error);
			}
		}
		if ( newm.voiceChannel ) {
			var newrole = newm.guild.roles.find( role => role.name === lang.channel + ' – ' + newm.voiceChannel.name );
			if ( newrole && newrole.comparePositionTo(newm.guild.me.highestRole) < 0 ) {
				console.log( newm.guild.name + ': ' + newm.displayName + ' joined the voice channel "' + newm.voiceChannel.name + '".' );
				newm.addRole( newrole, lang.join.replaceSave( '%1$s', newm.displayName ).replaceSave( '%2$s', newm.voiceChannel.name ) ).catch(log_error);
			}
		}
	}
} );


client.on( 'guildCreate', guild => {
	console.log( '- I\'ve been added to a server.' );
} );

client.on( 'guildDelete', guild => {
	console.log( '- I\'ve been removed from a server.' );
	if ( !guild.available ) {
		console.log( '- ' + guild.name + ': This server isn\'t responding.' );
		return;
	}
	
	if ( settings === defaultSettings ) {
		console.log( '- Error while getting current settings.' );
	}
	else {
		var temp_settings = JSON.parse(JSON.stringify(settings));
		var save = false;
		Object.keys(temp_settings).forEach( function(guild) {
			if ( !client.guilds.has(guild) && guild !== 'default' ) {
				delete temp_settings[guild];
				save = true;
			}
		} );
		if ( save ) request.post( {
			uri: process.env.save,
			headers: access,
			body: {
				branch: 'master',
				commit_message: client.user.username + ': Settings removed',
				actions: [
					{
						action: 'update',
						file_path: process.env.file,
						content: JSON.stringify( temp_settings, null, '\t' )
					}
				]
			},
			json: true
		}, function( error, response, body ) {
			if ( error || !response || response.statusCode !== 201 || !body || body.error ) {
				console.log( '- ' + ( response && response.statusCode ) + ': Error while removing the settings: ' + ( error || body && ( body.message || body.error ) ) );
			}
			else {
				settings = JSON.parse(JSON.stringify(temp_settings));
				console.log( '- Settings successfully removed.' );
			}
		} );
	}
} );


client.login(process.env.token).catch( error => {
	log_error(error, true, 'LOGIN-');
	client.login(process.env.token).catch( error => {
		log_error(error, true, 'LOGIN-');
		client.login(process.env.token).catch( error => {
			log_error(error, true, 'LOGIN-');
			process.exit(1);
		} );
	} );
} );


client.on( 'error', error => log_error(error, true) );
client.on( 'warn', warning => log_warn(warning, false) );

if ( isDebug ) client.on( 'debug', debug => {
	if ( isDebug ) console.log( '- Debug: ' + debug );
} );


/**
 * Log an error
 * @param {Error} [error] The error
 * @param {Boolean} [isBig=false] If major error
 * @param {String} [type=''] The type of the error
 */
function log_error(error, isBig = false, type = '') {
	var time = new Date(Date.now()).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' });
	if ( isDebug ) {
		console.error( '--- ' + type + 'ERROR START ' + time + ' ---\n', error, '\n--- ' + type + 'ERROR END ' + time + ' ---' );
	} else {
		if ( isBig ) console.log( '--- ' + type + 'ERROR: ' + time + ' ---\n-', error );
		else console.log( '- ' + error.name + ': ' + error.message );
	}
}

/**
 * Log a warning
 * @param {Object|*} [warning] The warning
 * @param {Boolean} [api=true] If warning from the MediaWiki API
 */
function log_warn(warning, api = true) {
	if ( isDebug ) {
		console.warn( '--- Warning start ---\n' + util.inspect( warning ) + '\n--- Warning end ---' );
	} else {
		if ( api ) console.warn( '- Warning: ' + Object.keys(warning).join(', ') );
		else console.warn( '--- Warning ---\n' + util.inspect( warning ) );
	}
}

/**
 * Graceful shoutdown
 * @async
 * @param {Number} [code=1] The exit code
 */
async function graceful(code = 1) {
	stop = true;
	console.log( '- SIGTERM: Preparing to close...' );
	setTimeout( async () => {
		console.log( '- SIGTERM: Destroying client...' );
		await client.destroy();
		setTimeout( async () => {
			console.log( '- SIGTERM: Closing takes too long, terminating!' );
			process.exit(code);
		}, 1000 ).unref();
	}, 2000 ).unref();
}

process.once( 'SIGINT', graceful );
process.once( 'SIGTERM', graceful );
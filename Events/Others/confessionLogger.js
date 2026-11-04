const { EmbedBuilder } = require('discord.js');

const LOG_BATCH_SIZE = 1, LOG_BATCH_DELAY = 1500, queues = new Map();

function enqueue(channel, embed){
 if(!queues.has(channel.id))queues.set(channel.id,{queue:[],running:false});
 const data=queues.get(channel.id);
 data.queue.push(embed);
 if(!data.running)processQueue(channel);
}

async function processQueue(channel){
 const data=queues.get(channel.id); if(!data)return;
 data.running=true;
 while(data.queue.length){
  const batch=data.queue.splice(0,LOG_BATCH_SIZE);
  for(const embed of batch)await channel.send({embeds:[embed]}).catch(()=>{});
  if(data.queue.length)await new Promise(r=>setTimeout(r,LOG_BATCH_DELAY));
 }
 data.running=false;
}

const ACTION_META={
 'CONFESSION POSTED':{color:'#57F287',emoji:'<a:tickyy:1555544712687915008>'},
 'AUTO-APPROVED':{color:'#57F287',emoji:'<:n_bot:1555544367886770176>'},
 'CONFESSION APPROVED':{color:'#57F287',emoji:'<a:tickyy:1555544712687915008>'},
 'CONFESSION SUBMITTED FOR REVIEW':{color:'#FEE75C',emoji:'<:files:1555544445565407352>'},
 'CONFESSION SUBMITTED':{color:'#FEE75C',emoji:'<:files:1555544445565407352>'},
 'CONFESSION DENIED':{color:'#ED4245',emoji:'<:crossy:1555544390221562048>'},
 'CONFESSION DELETED':{color:'#ED4245',emoji:'<:del:1555544395720302643>'},
 'CONFESSION REPORTED':{color:'#EB459E',emoji:'<:restrict:1555544549105999962>'},
 'USER ADDED TO BLACKLIST':{color:'#ED4245',emoji:'<:restrict:1555544549105999962>'},
 'USER REMOVED FROM BLACKLIST':{color:'#57F287',emoji:'<a:tickyy:1555544712687915008>'},
 'WORD FILTER TRIGGERED':{color:'#ED4245',emoji:'<:n_search:1555544554365788191>'},
 'Configuration Update':{color:'#5865F2',emoji:'<:n_utils:1555544669545431062>'},
};

function getMeta(action){
 for(const key in ACTION_META)if(action.toUpperCase().includes(key))return ACTION_META[key];
 return{color:'#808080',emoji:'<:files:1555544445565407352>'};
}

module.exports={
 name:'confessionLog',
 once:false,
 async execute(guild,config,action,details){
  if(!guild||!config?.LogChannel)return;
  const channel=guild.channels.cache.get(config.LogChannel);
  if(!channel)return;
  const {color,emoji}=getMeta(action);
  const embed=new EmbedBuilder()
   .setTitle(`${emoji} ${action}`)
   .setDescription(details||'No details provided.')
   .setColor(color)
   .setFooter({text:`Guild: ${guild.name}`,iconURL:guild.iconURL({dynamic:true})||undefined})
   .setTimestamp();
  enqueue(channel,embed);
 }
};

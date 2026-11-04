const { color, getTimestamp, textEffects } = require('./effects');

function asciiTextCommitRunner() {

    console.log(`${color.blue}                                                                                                              ${color.reset}`);
    console.log(`${color.blue}  ██████╗ ██████╗ ███╗   ███╗███╗   ███╗██╗████████╗    ██████╗ ██╗   ██╗███╗   ██╗███╗   ██╗███████╗██████╗  ${color.reset}`);
    console.log(`${color.blue} ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██║╚══██╔══╝    ██╔══██╗██║   ██║████╗  ██║████╗  ██║██╔════╝██╔══██╗ ${color.reset}`);
    console.log(`${color.blue} ██║     ██║   ██║██╔████╔██║██╔████╔██║██║   ██║       ██████╔╝██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗  ██████╔╝ ${color.reset}`);
    console.log(`${color.blue} ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██║   ██║       ██╔══██╗██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝  ██╔══██╗ ${color.reset}`);
    console.log(`${color.blue} ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║   ██║       ██║  ██║╚██████╔╝██║ ╚████║██║ ╚████║███████╗██║  ██║ ${color.reset}`);
    console.log(`${color.blue}  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝   ╚═╝       ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ${color.reset}`);
    console.log(`${color.blue}                                                                                                              ${color.reset}`);
}

function asciiCodeBaseStats() {

console.log(`${color.blue}                                                                                                                 ${color.reset}`);
console.log(`${color.blue}  ██████╗ ██████╗ ██████╗ ███████╗██████╗  █████╗ ███████╗███████╗    ███████╗████████╗ █████╗ ████████╗███████╗ ${color.reset}`);
console.log(`${color.blue} ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝██╔════╝    ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝ ${color.reset}`);
console.log(`${color.blue} ██║     ██║   ██║██║  ██║█████╗  ██████╔╝███████║███████╗█████╗      ███████╗   ██║   ███████║   ██║   ███████╗ ${color.reset}`);
console.log(`${color.blue} ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗██╔══██║╚════██║██╔══╝      ╚════██║   ██║   ██╔══██║   ██║   ╚════██║ ${color.reset}`);
console.log(`${color.blue} ╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝██║  ██║███████║███████╗    ███████║   ██║   ██║  ██║   ██║   ███████║ ${color.reset}`);
console.log(`${color.blue}  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝    ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ${color.reset}`);
console.log(`${color.blue}                                                                                                                 ${color.reset}`);

}

module.exports = { asciiTextCommitRunner, asciiCodeBaseStats };
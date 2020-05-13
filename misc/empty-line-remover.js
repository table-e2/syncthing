require('readline').createInterface({
    input: process.stdin
}).on('line', (line) => {
    if (`${line}`.trim().length !== 0) {
        console.log(line)
    }
})

const Http = new XMLHttpRequest();
const url = 'https://confusion-east-pulsar.glitch.me/';
Http.open("GET", url);

console.log('im raeady');

setInterval(() => {
    Http.send();
    Http.onreadystatechange = (e) => {
        console.log(Http.responseText)
    }
}, 1 * 60 * 1000)


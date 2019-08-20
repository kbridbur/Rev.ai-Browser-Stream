function doStream() {
    statusElement = document.getElementById("status");
    tableElement = document.getElementById("messages");
    finalsReceived = 0;
    currentCell = null;
    audioContext = new (window.AudioContext || window.WebkitAudioContext)();

    const access_token = 'YOUR-ACCESS-TOKEN';
    const content_type = `audio/x-raw;layout=interleaved;rate=${audioContext.sampleRate};format=S16LE;channels=1`;
    const baseUrl = 'wss://api.rev.ai/speechtotext/v1alpha/stream';
    const query = `access_token=${access_token}&content_type=${content_type}`;
    websocket = new WebSocket(`${baseUrl}?${query}`);

    websocket.onopen = onOpen;
    websocket.onclose = onClose;
    websocket.onmessage = onMessage;
    websocket.onerror = console.error;

    var button = document.getElementById("streamButton");
    button.onclick = endStream;
    button.innerHTML = "Stop";
}

function endStream() {
    if (websocket) {
        websocket.send("EOS");
        websocket.close();
    }
    if (audioContext) {
        audioContext.close();
    }

    var button = document.getElementById("streamButton");
    button.onclick = doStream;
    button.innerHTML = "Record";
}

function onOpen(event) {
    resetDisplay();
    statusElement.innerHTML = "Opened";
    navigator.mediaDevices.getUserMedia({ audio: true }).then((micStream) => {
        audioContext.suspend();
        var scriptNode = audioContext.createScriptProcessor(4096, 1, 1 );
        var input = input = audioContext.createMediaStreamSource(micStream);
        scriptNode.addEventListener('audioprocess', (event) => processAudioEvent(event));
        input.connect(scriptNode);
        scriptNode.connect(audioContext.destination);
        audioContext.resume();
    });
}

function onClose(event) {
    statusElement.innerHTML = `Closed with ${event.code}: ${event.reason}`;
}

function onMessage(event) {
    var data = JSON.parse(event.data);
    switch (data.type){
        case "connected":
            statusElement.innerHTML = "Connected";
            break;
        case "partial":
            currentCell.innerHTML = displayResponse(data);
            break;
        case "final":
            currentCell.innerHTML = displayResponse(data);
            if (data.type == "final"){
                finalsReceived++;
                var row = tableElement.insertRow(finalsReceived);
                currentCell = row.insertCell(0);
            }
            break;
        default:
            console.error("Received unexpected message");
            break;
    }
}

function processAudioEvent(e) {
    if (audioContext.state === 'suspended' || audioContext.state === 'closed' || !websocket) {
        return;
    }

    let inputData = e.inputBuffer.getChannelData(0);

    // The samples are floats in range [-1, 1]. Convert to PCM16le.
    let output = new DataView(new ArrayBuffer(inputData.length * 2));
    for (let i = 0; i < inputData.length; i++) {
        let multiplier = inputData[i] < 0 ? 0x8000 : 0x7fff; // 16-bit signed range is -32768 to 32767
        output.setInt16(i * 2, inputData[i] * multiplier | 0, true); // index, value, little edian
    }

    let intData = new Int16Array(output.buffer);
    let index = intData.length;
    while (index-- && intData[index] === 0 && index > 0) { }
    websocket.send(intData.slice(0, index + 1));
}

function displayResponse(response) {
    var message = "";
    for (var i = 0; i < response.elements.length; i++){
        message += response.elements[i].type == "text" ?  ` ${response.elements[i].value}` : response.elements[i].value;
    }
    return message;
}

function resetDisplay() {
    finalsReceived = 0;
    while(tableElement.hasChildNodes())
    {
        tableElement.removeChild(tableElement.firstChild);
    }
    var row = tableElement.insertRow(0);
    currentCell = row.insertCell(0);
}

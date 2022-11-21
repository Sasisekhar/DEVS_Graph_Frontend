import { save } from './app.js';

let downloadButton = document.getElementById("downloadButton");
downloadButton.addEventListener("click",download);

function download() {
    let data = transformData(save());
    fetch('http://localhost:8080/cadmium/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((res) => {
            return res.blob();
        })
        .then((blob) => {
            let id = crypto.randomUUID();
            var file = new File([blob], id + ".zip");
            var fileURL = URL.createObjectURL(file);

            // create <a> tag dinamically
            var fileLink = document.createElement('a');
            fileLink.href = fileURL;

            // it forces the name of the downloaded file
            fileLink.download = id + '.zip';

            // triggers the click event
            fileLink.click();
        })
        .catch((e) => console.log(e));
}


//Temp transformations:

// let data = { "class": "GraphLinksModel", "copiesArrays": true, "copiesArrayObjects": true, "linkFromPortIdProperty": "fromPort", "linkToPortIdProperty": "toPort", "modelData": { "position": "706.9363032122078 439.63213305831937" }, "nodeDataArray": [{ "text": "*start\nTa=4", "figure": "Ellipse", "size": "85 85", "fill": "white", "key": -1, "loc": "1447.5 723.227", "group": -4 }, { "text": "process\nTa=10", "figure": "Ellipse", "size": "115 112", "fill": "white", "key": -2, "loc": "1877.5 723.227", "group": -4 }, { "text": "finish\nTa=7", "figure": "Ellipse", "size": "85 85", "fill": "white", "key": -3, "loc": "1585.54835552058 888.6092855600116", "group": -4 }, { "text": "Processor", "isGroup": true, "color": "blue", "I": [{ "id": "I1", "text": "in\nint", "color": "red" }], "O": [], "key": -4, "group": -6 }, { "text": "IEStream\ntype=int", "figure": "Rectangle", "size": "90 65", "fill": "white", "key": -5, "loc": "1095 612.4999999999986", "group": -6 }, { "text": "top_model", "isGroup": true, "color": "blue", "I": [], "O": [], "key": -6 }], "linkDataArray": [{ "points": [1447.5, 680.727, 1447.5, 670.727, 1447.5, 657.227, 1662.5, 657.227, 1877.5, 657.227, 1877.5, 667.227], "color": "black", "from": -1, "to": -2, "fromPort": "T", "toPort": "T", "label": "in?4" }, { "from": -3, "to": -2, "fromPort": "", "toPort": "", "points": [1628.04835552058, 888.6092855600116, 1638.04835552058, 888.6092855600116, 1724.02417776029, 888.6092855600116, 1724.02417776029, 723.2269999999999, 1810, 723.2269999999999, 1820, 723.2269999999999], "label": "in?2" }, { "points": [1935, 723.227, 1945, 723.227, 1945, 888.6092855600117, 1791.52417776029, 888.6092855600117, 1638.04835552058, 888.6092855600117, 1628.04835552058, 888.6092855600117], "dash_array": [6, 3], "from": -2, "to": -3, "fromPort": "R", "toPort": "R", "label": "out!1" }, { "points": [1543.04835552058, 888.6092855600116, 1533.04835552058, 888.6092855600116, 1447.5, 888.6092855600116, 1447.5, 832.1681427800058, 1447.5, 775.7269999999999, 1447.5, 765.7269999999999], "dash_array": [6, 3], "from": -3, "to": -1, "fromPort": "L", "toPort": "B", "label": "out!6" }, { "points": [1140, 612.5, 1150, 612.5, 1242.1192881254233, 612.5, 1242.1192881254233, 611.2873551765252, 1334.238576250846, 611.2873551765252, 1344.238576250846, 611.2873551765252], "color": "red", "arrow_color": "red", "fill_arrow": "red", "from": -5, "to": -4, "fromPort": "R", "toPort": "I1", "label": "" }] };
function transformData(data) {
    data = JSON.parse(data);
    let nodeData = data.nodeDataArray;
    let linkData = data.linkDataArray;
    let states = [];
    let model = [];
    let group_keys = [];


    nodeData.forEach(d => {
        if (d.hasOwnProperty("isGroup") && d.isGroup) {
            model.push(d);
            group_keys.push(d.key);
        }
        else
            states.push(d);
    })
    let request_body = {};
    let coupled = [];
    let atomics = [];
    let coupled_id = {};
    let atomic_id = {};
    let model_dict = {};

    nodeData.forEach(d => {
        model_dict[d.key] = d;
    });
    nodeData.forEach(d => {
        if ((d.hasOwnProperty('group') && d.hasOwnProperty('isGroup')) || d.figure === "Rectangle") {
            if (coupled_id.hasOwnProperty(d.group))
                coupled_id[d.group].push(d.key);
            else
                coupled_id[d.group] = [d.key];
        }
        else if (d.hasOwnProperty('group') && !d.hasOwnProperty('isGroup')) {
            if (atomic_id.hasOwnProperty(d.group))
                atomic_id[d.group].push(d.key);
            else
                atomic_id[d.group] = [d.key];
        }
    })
    model.forEach(m => {
        if (coupled_id.hasOwnProperty(m.key)) {
            let coupled_obj = { name: m.text };

            let components = [];
            model.forEach(d => {
                if (d.group === m.key)
                    components.push(d.text);
            })
            if (states.filter(s => (s.figure == "Rectangle" && s.group == m.key)).length > 0)
                components.push("IEStream");
            coupled_obj['components'] = components;
            if (m.text === "top_model") {
                coupled_obj.top = { name: m.text, out_port: 'outPort' };
                request_body.top = { name: m.text, out_port: 'outPort' };
            }
            let links = linkData.filter(l => {
                return l.color == 'red' && (coupled_id[m.key].includes(l.from) || coupled_id[m.key].includes(l.to))
            })
            let couplings = [];
            links.forEach(l => {
                let from_key = l.from;
                let to_key = l.to;
                let from_model = model_dict[from_key];
                let to_model = model_dict[to_key];
                let fname = from_model.text.split("\n")[0];
                let tname = to_model.text.split("\n")[0];
                let from_p, to_p;
                if (fname === "IEStream")
                    from_p = 'out';
                else {
                    from_p = l.fromPort;
                    from_model.O.forEach(ports => {
                        if (ports.id === l.fromPort)
                            from_p = ports.text;
                    })
                }
                to_model.I.forEach(ports => {
                    if (ports.id === l.toPort)
                        to_p = ports.text;
                })
                let coupling_obj = {
                    from_model: fname,
                    to_model: tname,
                    from_port: from_p,
                    to_port: to_p
                };
                couplings.push(coupling_obj);
            })
            coupled_obj.couplings = couplings;
            coupled.push(coupled_obj);
        }
    })

    for (let key of Object.keys(atomic_id)) {
        let curr_atomic = model_dict[key];
        let atomic_obj = { name: curr_atomic.text };
        let states = {};
        atomic_id[key].forEach(d => {
            let state_obj = model_dict[d];
            let sname = state_obj.text.split("\n");
            if (sname[0].charAt(0) === '*') {
                sname[0] = sname[0].substring(1);
                atomic_obj['initial_state'] = sname[0]
            }
            states[sname[0]] = sname[1].split("=")[1] == "inf" ? "inf" : parseInt(sname[1].split("=")[1]);
        })
        let inports = [], outports = [];
        curr_atomic.I.forEach(d => {
            let port = d.text.split("\n");
            inports.push({ name: port[0], type: port[1] });
        })
        curr_atomic.O.forEach(d => {
            let port = d.text.split("\n");
            outports.push({ name: port[0], type: port[1] });
        })
        atomic_obj['inports'] = inports;
        atomic_obj['outports'] = outports;
        atomic_obj['states'] = states;
        let internal = [], external = [], output = [];
        linkData.filter(d =>
            atomic_id[key].includes(d.from) || atomic_id[key].includes(d.to)
        ).forEach(d => {
            if (d.hasOwnProperty('dash_array')) {
                let label = d.label.split("!");
                internal.push({
                    curr_state: model_dict[d.from].text.split("\n")[0],
                    new_state: model_dict[d.to].text.split("\n")[0]
                });
                output.push({
                    curr_state: model_dict[d.from].text.split("\n")[0],
                    port: label[0],
                    value: label[1]
                })
            }
            else {
                let label = d.label.split("?");
                external.push({
                    port: label[0],
                    value: label[1],
                    curr_state: model_dict[d.from].text.split("\n")[0],
                    new_state: model_dict[d.to].text.split("\n")[0]
                })
            }
        })
        atomic_obj['internal_transitions'] = internal;
        atomic_obj['external_transitions'] = external;
        atomic_obj['output'] = output;
        atomics.push(atomic_obj);
    }
    request_body.atomic = atomics;
    request_body.coupled = coupled;
    console.log(request_body);
    return request_body;
}

import { save } from './app.js';

let downloadButton = document.getElementById("downloadButton");
downloadButton.addEventListener("click", generate);
function generate() {
    let data = transformData(save());
    fetch('https://devs-graph-backend.onrender.com/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    }).then((res) => {
        return res.blob();
    }).then((blob) => {
        saveAs(blob, document.getElementById("modalname").value + ".zip")
    }).catch((e) => console.log(e));
}

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
                coupled_obj.top = { name: m.text, out_port: m.O[0].text.split("\n")[0] };
                request_body.top = { name: m.text, out_port: m.O[0].text.split("\n")[0] };
            }
            let links = linkData.filter(l => {
                return l.color == 'red' &&
                    ((coupled_id[m.key].includes(l.from) && coupled_id[m.key].includes(l.to)) ||
                        (l.from == m.key && coupled_id[m.key].includes(l.to)) ||
                        (l.to == m.key && coupled_id[m.key].includes(l.from)))
            })
            let couplings = [];
            let inports = [], outports = [];
            m.I.forEach(d => {
                let port = d.text.split("\n");
                inports.push({ name: port[0], type: port[1] });
            })
            m.O.forEach(d => {
                let port = d.text.split("\n");
                outports.push({ name: port[0], type: port[1] });
            })
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
                    // from_p = l.fromPort;
                    from_model.O.forEach(ports => {
                        if (ports.id === l.fromPort)
                            from_p = ports.text.split("\n")[0];
                    })
                    if (from_p === undefined) {
                        from_model.I.forEach(ports => {
                            if (ports.id === l.fromPort)
                                from_p = ports.text.split("\n")[0];
                        })
                        fname = "";
                    }
                }
                to_model.I.forEach(ports => {
                    if (ports.id === l.toPort)
                        to_p = ports.text.split("\n")[0];
                })
                if (to_p === undefined) {
                    to_model.O.forEach(ports => {
                        if (ports.id === l.toPort)
                            to_p = ports.text.split("\n")[0];
                    })
                    tname = ""
                }
                let coupling_obj = {
                    from_model: fname,
                    to_model: tname,
                    from_port: from_p,
                    to_port: to_p
                };
                couplings.push(coupling_obj);
            })
            coupled_obj.inports = inports;
            coupled_obj.outports = outports;
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
                atomic_obj['initial_state'] = sname[0];
                model_dict[d].text = sname[0] + "\n" + sname[1];
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


const modals = document.querySelectorAll('[data-modal]');

modals.forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
        event.preventDefault();
        const modal = document.getElementById(trigger.dataset.modal);
        modal.classList.add('open');
        const exits = modal.querySelectorAll('.modal-exit');
        exits.forEach(function (exit) {
            exit.addEventListener('click', function (event) {
                event.preventDefault();
                modal.classList.remove('open');
            });
        });
    });
});

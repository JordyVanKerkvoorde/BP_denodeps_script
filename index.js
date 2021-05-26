const axios = require('axios');
const fs = require('fs');
require('dotenv').config()

async function fetchAllDenoDeps(){
    let pagesize = 100;
    let pages;
    let dependencies = [];

    pages = Math.ceil((await axios.get("https://api.deno.land/modules")).data.data.total_count / pagesize);

    for(let i = 1; i <= pages; i++) {
        const uri = `https://api.deno.land/modules?page=${i}&limit=${pagesize}`
        const response = (await axios.get(uri)).data;
        dependencies.push(...response.data.results);
    }

    let denodeps = []

    for(let i = 0; i < dependencies.length; i++) {
        try{
            const versionsUri = `https://cdn.deno.land/${dependencies[i].name}/meta/versions.json`
            const latestversion = (await axios.get(versionsUri)).data.latest;

            const uploadUri = `https://cdn.deno.land/${dependencies[i].name}/versions/${latestversion}/meta/meta.json`
            const uploaddata = (await axios.get(uploadUri)).data;

            const depObj = {
                name: dependencies[i].name,
                upload_options: uploaddata.upload_options
            }

            console.log(depObj.name)

            denodeps.push(depObj);
        } catch(err){
            console.log('Reserved Dependency')
        }
    }

    console.log(denodeps.length)

    fs.writeFileSync('./denodeps.json',  JSON.stringify(denodeps, null, 2), 'utf8');
}

// fetchAllDenoDeps();

async function test() {
    const uri = `https://api.deno.land/modules?page=${1}&limit=${100}`
    const response = (await axios.get(uri)).data;
    const results = response.data.results;

    const versionsUri = `https://cdn.deno.land/${results[0].name}/meta/versions.json`
    const latestversion = (await axios.get(versionsUri)).data.latest;

    const uploadUri = `https://cdn.deno.land/${results[0].name}/versions/${latestversion}/meta/meta.json`
    
    const uploaddata = (await axios.get(uploadUri)).data;

    const t = [{
        name: results[0].name,
        upload_options: uploaddata.upload_options
    }]
    console.log(t)

    fs.writeFileSync('./denodeps.json',  JSON.stringify(t, null, 2), 'utf8');
}

// test()

async function fetchGitHubData(){
    const fileObject = JSON.parse(fs.readFileSync('./denodeps.json', 'utf8'));

    let denoDepLastCommit = []

    for(let i = fileObject.length - 1; i >= 0; i--) {
        try{
            const uri = `http://api.github.com/repos/${fileObject[i].upload_options.repository}/commits`;
            const lastCommit = (await axios.get(uri, { headers: { 'Authorization': `token ${process.env.GITTOKEN}`}})).data[0].commit;
            
            const commObj = {
                name: fileObject[i].name,
                repo: fileObject[i].upload_options.repository,
                lastCommitDate: lastCommit.author.date
            };

            if(fileObject[i].name === 'atenas_cli') break;

            denoDepLastCommit.push(commObj);

            if(i % 100 === 0) console.log(`${i}/${fileObject.length}`);

        } catch(err) {
            console.log(err)
        }
    }

    fs.writeFileSync('./lastcommit.json',  JSON.stringify(denoDepLastCommit, null, 2), 'utf8');
}

// fetchGitHubData()

function median(values){
    if(values.length ===0) return 0;
  
    values.sort(function(a,b){
      return a-b;
    });
  
    var half = Math.floor(values.length / 2);
  
    if (values.length % 2)
      return values[half];
  
    return (values[half - 1] + values[half]) / 2.0;
}

function getValuesFromData(){
    const fileObject = JSON.parse(fs.readFileSync('./lastcommit.json', 'utf8'));

    const maxDate = new Date(Math.max.apply(null, fileObject.map(x => new Date(x.lastCommitDate)))).toISOString().slice(0, 10);
    const minDate = new Date(Math.min.apply(null, fileObject.map(x => new Date(x.lastCommitDate)))).toISOString().slice(0, 10);

    console.log(maxDate);
    console.log(minDate)

    const begin = new Date('2020-05-13');
    const end = new Date();

    const datesInMillis = fileObject.map(x => new Date(x.lastCommitDate).getTime())

    
    const medianVal = new Date(median(datesInMillis)).toISOString().slice(0, 10);
    const average = new Date(datesInMillis.reduce((a, b) => a + b) / datesInMillis.length).toISOString().slice(0, 10);

    console.log(`
        Begin: ${begin.toISOString().slice(0, 10)}
        End: ${end.toISOString().slice(0, 10)}
        maxDate: ${maxDate}
        Median: ${medianVal}
        Average: ${average}
    `)

    const stat = stats(datesInMillis)


    console.log(`
    Boxplot values:
        low: ${((begin.getTime() - begin.getTime()) / (end.getTime() - begin.getTime()).toFixed(2))}
        high: ${((end.getTime() - begin.getTime()) / (end.getTime() - begin.getTime())).toFixed(2)}
        q1: ${((stat.q1 - begin.getTime()) / (end.getTime() - begin.getTime())).toFixed(2)}
        median: ${((stat.median - begin.getTime()) / (end.getTime() - begin.getTime())).toFixed(2)}
        q3: ${((stat.q3 - begin.getTime()) / (end.getTime() - begin.getTime())).toFixed(2)}
    `)
    
}

function stats(arr) {
    const asc = arr => arr.sort((a, b) => a - b);

    const sum = arr => arr.reduce((a, b) => a + b, 0);

    const mean = arr => sum(arr) / arr.length;

    // sample standard deviation
    const std = () => {
        const mu = mean(arr);
        const diffArr = arr.map(a => (a - mu) ** 2);
        return Math.sqrt(sum(diffArr) / (arr.length - 1));
    };

    const quantile = (arr, q) => {
        const sorted = asc(arr);
        const pos = (sorted.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (sorted[base + 1] !== undefined) {
            return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        } else {
            return sorted[base];
        }
    };

    const q25 = quantile(arr, .25);

    const q50 = quantile(arr, .50);

    const q75 = quantile(arr, .75);

    const median = q50;

    return {
        q1: q25,
        median: q50,
        q3: q75,
        std: std()
    }
}



getValuesFromData()
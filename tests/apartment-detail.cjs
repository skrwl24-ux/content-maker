const assert=require('node:assert/strict');const {load}=require('./load-ts.cjs');
const a=load('lib/apartment-analysis.ts');const month=a.requestedMonths().at(-1);
async function run(group, rows){
 const tables={apt_complexes:[{id:'x',name:'검증단지',households:null,use_date:null}],apt_candidate_snapshots:[{complex_id:'x',representative_area_group:group}],apt_monthly_stats:[{complex_id:'x',area_group:group,year_month:month,median_price:9999999999,trade_count:8}],apt_trades:rows};
 const calls=[];
 function from(table){let data=tables[table];const q={select(){return q},eq(k,v){calls.push([table,'eq',k,v]);data=data.filter(r=>r[k]===v);return q},gte(k,v){data=data.filter(r=>r[k]>=v);return q},lte(k,v){data=data.filter(r=>r[k]<=v);return q},lt(k,v){data=data.filter(r=>r[k]<v);return q},order(k,o){data=[...data].sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(o.ascending?1:-1));return q},limit(n){data=data.slice(0,n);return q},range(a,b){data=data.slice(a,b+1);return q},single(){return Promise.resolve({data:data[0],error:null})},maybeSingle(){return Promise.resolve({data:data[0]||null,error:null})},then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject)}};return q;}
 const route=load('app/api/apartment/complexes/[id]/route.ts',{'@/lib/apartment-server':{createApartmentReadClient:()=>({from})}});
 return {response:await route.GET({}, {params:Promise.resolve({id:'x'})}),calls};
}
(async()=>{
const base={complex_id:'x',contract_date:month+'-15',floor:5,cancelled:false};
const rows=[{...base,id:'1',exclusive_area:101.88,area_group:101,price_won:750000000},{...base,id:'2',exclusive_area:134.9,area_group:134,price_won:850000000},{...base,id:'3',exclusive_area:134.9,area_group:134,price_won:990000000,cancelled:true}];
const {response}=await run(134,rows);assert.equal(response.status,200);assert.equal(response.data.latestTrade.area,134.9);assert.equal(response.data.latestTrade.price,850000000);assert.equal(response.data.monthly.at(-1).medianPrice,850000000);assert.equal(response.data.monthly.at(-1).tradeCount,1);assert.equal(response.data.complex.households,null);
const none=(await run(134,[rows[0]])).response;assert.equal(none.data.latestTrade,null);assert.equal(none.data.monthly.at(-1).medianPrice,null);assert.equal(none.data.monthly.at(-1).tradeCount,0);
assert.equal((await run(null,rows)).response.data.latestTrade,null);
console.log('PASS real detail route: mismatched area excluded, matching actual area/date, cancelled trade excluded, stale monthly cache recalculated, absent metadata preserved');
})().catch(e=>{console.error(e);process.exitCode=1});

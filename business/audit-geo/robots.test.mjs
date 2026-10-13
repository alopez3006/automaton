import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRobots} from './robots.mjs';
const observation=body=>({url:'https://example.com/robots.txt',status:200,observedAt:'2026-10-13T13:00:00Z',body});
const evaluate=(body,path='/')=>evaluateRobots(observation(body),['https://example.com'+path]).evaluations;
test('search and training groups remain independent; wildcard is fallback, not merged',()=>{
 const e=evaluate('User-agent: *\nDisallow: /\nUser-agent: GPTBot\nDisallow: /\nUser-agent: OAI-SearchBot\nAllow: /');
 assert.equal(e.find(e=>e.agent==='OAI-SearchBot').status,'allowed_according_to_robots_txt');
 assert.equal(e.find(e=>e.agent==='GPTBot').status,'disallowed_according_to_robots_txt');
 assert.equal(e.find(e=>e.agent==='Claude-SearchBot').usage,'search');
});
test('longest rule, equal allow tie, repeated groups, comments and multiple agents',()=>{
 const body='User-agent: Googlebot\nUser-agent: OAI-SearchBot\nDisallow: /private # hidden\nAllow: /private/public\nUser-agent: googlebot\nAllow: /private';
 assert.equal(evaluate(body,'/private').find(e=>e.agent==='Googlebot').status,'allowed_according_to_robots_txt');
 assert.equal(evaluate(body,'/private/secret').find(e=>e.agent==='OAI-SearchBot').status,'disallowed_according_to_robots_txt');
 assert.equal(evaluate(body,'/private/public').find(e=>e.agent==='OAI-SearchBot').status,'allowed_according_to_robots_txt');
});
test('wildcards, end anchors, query strings, case and percent encoded unreserved paths',()=>{
 const body='User-agent: *\nDisallow: /*.pdf$\nDisallow: /path?secret=\nDisallow: /~user\nDisallow: /Case';
 for(const path of ['/a.pdf','/path?secret=yes','/%7Euser'])assert.equal(evaluate(body,path)[0].status,'disallowed_according_to_robots_txt');
 for(const path of ['/a.pdf?x=1','/case'])assert.equal(evaluate(body,path)[0].status,'allowed_according_to_robots_txt');
 assert.equal(evaluate('User-agent: *\nDisallow: /a%2fb','/a%2Fb')[0].status,'disallowed_according_to_robots_txt');
 assert.equal(evaluate('User-agent: *\nDisallow: /a%2fb','/a/b')[0].status,'allowed_according_to_robots_txt');
});
test('empty rules allow by default; unavailable or unsupported evidence stays unknown',()=>{
 assert.equal(evaluate('User-agent: *\nDisallow:')[0].status,'allowed_according_to_robots_txt');
 for(const status of [404,403,429,503])assert.equal(evaluateRobots({...observation(''),status},['https://example.com/']).status,'unknown');
 for(const extra of [{error:'timeout'},{bodyTruncated:true},{body:'<!doctype html>'}])assert.equal(evaluateRobots({...observation(''),...extra},['https://example.com/']).status,'unknown');
 assert.equal(evaluate('User-agent: *\nDisallow: relative')[0].status,'unknown');
 assert.equal(evaluateRobots(observation(''),['https://other.example/']).evaluations[0].status,'unknown');
});

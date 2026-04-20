import { TinTinConverter } from '../src/converter.js';

const converter = new TinTinConverter({ mode: 'powwow' });

const samples = [
    '#action >+autodrink1 clear spring babbles={#print;drink water}',
    '#action >+autodrink2 ^A &1fountain={#print;drink water}',
    '#alias notify={#print ($BLUE+"  "+$(0)+$NORM)}',
    '#action %-afk m([^ ]+) tells you .+={#print; #if (!@autoreplied_$2) { #send ("tell $2 I\'m either AFK or otherwise distracted. Please leave a message and I\'ll get back to you. :)"); #var @autoreplied_$2=1 };  setqt $2 }',
    '#alias setqt={#alias qt=tell $1 \\$0; #add $1}',
    '#action %+mobsay1   m(The|An|A) ([a-zA-Z \\,\\\'\\-]+) (tells you|says|asks you|whispers to you) (.+)=#print ("$2 "+$MOBCOL+"$3"+$NORM+" $4 "+$GREEN+"$5"+$NORM)',
    '#action >+BlockResist ^Your power blocking the $1 resisted a breaking attempt!={#print (attr "cyan" + "Your power blocking the " + attr "yellow" + ">> $1 <<" + attr "cyan" + " resisted a breaking attempt!" + noattr+$NORM)}',
    '#action >-filllant1 You pour all your remaining oil into &1 lantern.={#print;hide oil;gt oil;fill lantern}',
    '#action %-shallaya ^(.+>)?Shallaya$={#print; dkon;#var $primary=claymore; #var $primaryh=2; #var $cweap=("bejewelled"); #alias C=shalC; #alias V=shalV; #var $petalpouch=pouch; #var $backpack=silvan; #var @stunpouches=0; #var $name=Shallaya; #var $chartitle=(" the Broken Hand of Vána");#print ($BOLD+$BLUE+"---+++*** SHALLAYA LOADED ***+++---"+$NORM) ; charloadoff}'
];

console.log('--- CONVERSION TEST ---');
samples.forEach(s => {
    console.log('INPUT:', s);
    console.log('OUTPUT:');
    console.log(converter.convert(s));
    console.log('------------------------');
});

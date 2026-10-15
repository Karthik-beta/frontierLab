"""Build js/data/archive.js from the verified research JSON plus in-game trigger mapping.

Usage: python3 tools/build_archive.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'research' / 'artifacts_research.json'
SRC2 = ROOT / 'tools' / 'research' / 'research_round2.json'
OUT = ROOT / 'js' / 'data' / 'archive.js'
OUT_ACH = ROOT / 'js' / 'data' / 'achievements.js'
SRC3 = ROOT / 'tools' / 'research' / 'research_marketing.json'
SRC4 = ROOT / 'tools' / 'research' / 'research_growth.json'

# artifact id -> (trigger key or list, rarity). Unlisted ids are 'common' (random quarterly epigraphs).
TRIGGERS = {
    'openai-founding-2015': (['start:idealists', 'policy:nonprofit'], 'rare'),
    'openai-capped-profit-2019': ('cancel:nonprofit', 'rare'),
    'microsoft-1b-2019': (['dilemma:megaInvestment:0', 'policy:cloudDeal'], 'rare'),
    'microsoft-10b-2023': ('tier:Decacorn', 'rare'),
    'chatgpt-100m-users': ('policy:consumerApp', 'rare'),
    'altman-fired': ('pitfall:governanceBomb', 'legendary'),
    'nadella-microsoft-new-team': ('pitfall:governanceBomb', 'legendary'),
    'openai-employee-letter': ('reinstated', 'legendary'),
    'sutskever-regret': ('reinstated', 'legendary'),
    'altman-reinstated': ('reinstated', 'legendary'),
    'nadella-below-above-around': ('pitfall:platformCapture', 'rare'),
    'superalignment-20-percent': (['dilemma:pit:safetyExodus:0', 'policy:alignment:max'], 'rare'),
    'leike-resignation': ('pitfall:safetyExodus', 'rare'),
    'ssi-founded': ('rival:spawned', 'rare'),
    'scarlett-sky-her': ('dilemma:voiceLawsuit', 'rare'),
    'anthropic-founded': (['start:defectors', 'dilemma:pit:safetyExodus:1'], 'rare'),
    'anthropic-rsp': ('policy:rsp', 'rare'),
    'machines-of-loving-grace': (['ending:aligned', 'policy:culture:max'], 'legendary'),
    'gpt2-withheld': (['dilemma:deceptiveEval:0', 'policy:redteam:max'], 'rare'),
    'openai-pbc-2025': ('cancel:nonprofit', 'rare'),
    'bard-jwst-error': ('pitfall:demoDisaster', 'rare'),
    'microsoft-tay': ('pitfall:tayMoment', 'rare'),
    'meta-galactica': ('pitfall:tayMoment', 'rare'),
    'bing-sydney': ('situation:jailbreak', 'rare'),
    'gemini-image-pause': ('policy:moderation:max', 'rare'),
    'samsung-chatgpt-leak': ('pitfall:dataLeak', 'rare'),
    'llama-leak': (['situation:weightsLeak', 'policy:openWeights'], 'rare'),
    'no-moat-memo': ('dilemma:rivalOpen', 'rare'),
    'deepseek-nvidia-rout': ('pitfall:cheapShock', 'legendary'),
    'stargate-announcement': ('policy:datacenters:max', 'rare'),
    'three-mile-island-restart': ('policy:energy', 'rare'),
    'xai-colossus': ('policy:datacenters', 'rare'),
    'inflection-microsoft': ('pitfall:acquihire', 'rare'),
    'adept-amazon': ('ending:acquihired', 'rare'),
    'character-ai-google': ('ending:acquihired', 'rare'),
    'character-ai-lawsuits': ('situation:aiPanic', 'rare'),
    'stability-mostaque-exit': ('bridge', 'rare'),
    'builder-ai-collapse': ('pitfall:theranos', 'rare'),
    'air-canada-chatbot': ('policy:agents', 'rare'),
    'nyt-v-openai': ('pitfall:copyrightReckoning', 'rare'),
    'bartz-v-anthropic': (['dilemma:pit:copyrightReckoning:0', 'situation:lawsuit'], 'rare'),
    'getty-v-stability': ('policy:scraping', 'rare'),
    'hinton-leaves-google': ('situation:talentExodus', 'rare'),
    'fli-pause-letter': ('situation:aiPanic', 'rare'),
    'yudkowsky-shut-it-down': ('era:endgame', 'rare'),
    'cais-extinction-statement': ('era:scaling', 'rare'),
    'altman-end-of-world': ('policy:ceoTour', 'rare'),
    'dartmouth-1956': ('start', 'rare'),
    'lighthill-report': ('situation:bubble', 'rare'),
    'alexnet-2012': ('model:Ember', 'rare'),
    'deepmind-acquired': ('start:spinout', 'rare'),
    'alphago-move-37': ('model:Lantern', 'rare'),
    'attention-is-all-you-need': ('policy:publish', 'rare'),
    'karpathy-software-2': ('policy:coding', 'rare'),
    'bitter-lesson': ('policy:pretrain', 'rare'),
    'altman-7-trillion': ('policy:chips', 'rare'),
    'jensen-more-you-buy': (['policy:gpuSpot', 'dilemma:gpuPrepay:0'], 'rare'),
    'hinton-nobel': ('model:Comet', 'rare'),
    'pg-dont-scale': ('policy:entSales', 'rare'),
    'pg-default-alive': ('profitable', 'rare'),
    'startup-genome-premature-scaling': ('pitfall:prematureScaling', 'rare'),
    'grove-paranoid': ('situation:frontierLeader', 'rare'),
    'grove-memory-exit': ('dilemma:pit:kodakMoment:0', 'rare'),
    'horowitz-wartime-ceo': ('dilemma:boardRevolt', 'rare'),
    'software-eating-world': ('tier:Unicorn', 'rare'),
    'its-time-to-build': ('policy:datacenters', 'rare'),
    'move-fast-break-things': ('policy:crunch', 'rare'),
    'theranos': ('pitfall:theranos', 'legendary'),
    'wework-ipo': ('pitfall:weworkMoment', 'rare'),
    'quibi': ('policy:marketing:max', 'rare'),
    'webvan': ('pitfall:fiberGlut', 'rare'),
    'pets-com': ('policy:marketing', 'rare'),
    'ftx': ('ending:bankrupt', 'legendary'),
    'friendster': ('pitfall:hugOfDeath', 'rare'),
    'xerox-parc': ('pitfall:kodakMoment', 'rare'),
    'kodak-digital-camera': ('pitfall:kodakMoment', 'rare'),
    'blockbuster-netflix': ('dilemma:acquihire:1', 'rare'),
    'traitorous-eight': ('pitfall:traitorousEight', 'rare'),
    'netscape-browser-war': ('pitfall:platformCapture', 'rare'),
    'dont-be-evil': ('policy:culture', 'rare'),
    'bell-labs': ('policy:interp', 'rare'),
}

TRIGGERS2 = {
    'uber-fourteen-values': ('culture:superpumped', 'rare'),
    'delete-uber': ('dilemma:pit:theBlogPost:1:lose', 'rare'),
    'fowler-strange-year': ('pitfall:theBlogPost', 'legendary'),
    'greyball': ('dilemma:greyball', 'rare'),
    'holder-report-leave': ('dilemma:pit:theBlogPost:0', 'rare'),
    'kalanick-resigns': (['dilemma:pit:theBlogPost:1:lose', 'ending:ousted'], 'legendary'),
    'uber-cultural-norms': ('dilemma:pit:theBlogPost:0', 'rare'),
    'waymo-v-uber': ('policy:poach', 'rare'),
    'netflix-culture-deck': ('practice:noJerks', 'rare'),
    'netflix-keeper-test': ('practice:keeperTest', 'rare'),
    'no-brilliant-jerks': ('hire:jerk', 'rare'),
    'amazon-bar-raiser': ('practice:barRaiser', 'rare'),
    'google-project-oxygen': ('manager:first', 'rare'),
    'jobs-a-players': ('team:5', 'rare'),
    'zappos-the-offer': ('practice:payToQuit', 'rare'),
    'move-fast-stable-infra': ('dilemma:pit:hugOfDeath:0', 'rare'),
    'openai-staff-letter': ('dilemma:boardRevolt:1:win', 'rare'),
    'meta-superintelligence-spree': ('hire:legend', 'rare'),
    'openai-broken-into-home': ('people:seniorLeft', 'rare'),
    'deepmind-garden-leave': ('team:25', 'rare'),
    'twitter-half-layoffs': ('dilemma:pit:prematureScaling:0', 'rare'),
    'extremely-hardcore': ('practice:hardcore', 'rare'),
    'theranos-secrecy': ('dilemma:pit:theranos:1:lose', 'rare'),
    'amazon-biased-recruiter': ('pitfall:biasedScreener', 'rare'),
    'llama3-interruptions': ('hw:failures', 'rare'),
    'useful-life-stretch': ('hw:firstDelivery', 'rare'),
    'burry-depreciation': ('hw:obsolete', 'rare'),
    'chief-revenue-destroyer': ('hw:newGen', 'rare'),
    'nvidia-one-year-rhythm': ('hw:newGen', 'rare'),
    'h100-shortage': ('situation:gpuCrunch', 'rare'),
    'gpu-rental-collapse': ('policy:gpuSpot:max', 'rare'),
    'microsoft-lease-pullback': ('pitfall:fiberGlut', 'rare'),
    'oracle-openai-300b': ('deal:neocloud', 'rare'),
    'nvidia-openai-100b-to-30b': ('deal:circular', 'legendary'),
    'amd-openai-warrants': ('deal:circular', 'rare'),
    'broadcom-openai-custom': ('policy:chips:max', 'rare'),
    'coreweave-openai': ('deal:neocloud', 'rare'),
    'microsoft-openai-restructure': ('deal:equity', 'rare'),
    'anthropic-google-tpus': ('deal:rivalCloud', 'rare'),
    'project-rainier': ('deal:rivalCloud', 'rare'),
    'anthropic-microsoft-nvidia': ('deal:equity', 'rare'),
    'circular-deals': ('deal:circular', 'rare'),
    'google-tpu-2016': ('policy:chips', 'rare'),
    'musk-v-openai-verdict': ('dilemma:pit:copyrightReckoning:1:win', 'rare'),
}
SKIP2 = {'xai-colossus', 'deepseek-selloff', 'stargate'}  # duplicates of round-one cards

ACH = {
    'sparks-fly': 'dilemma:sparksPaper:0', 'its-alive': 'dilemma:sentientClaim:1', 'bogus-precedent': 'dilemma:fakeCitations',
    'how-many-rs': 'dilemma:strawberry', 'extra-adhesive': 'dilemma:glueOnPizza', 'no-takesies-backsies': 'dilemma:dollarTahoe',
    'separate-legal-entity': 'dilemma:botBlame:1:lose', 'sixteen-hours': 'pitfall:tayMoment', 'upstream-code-path': 'dilemma:systemPrompt:1',
    'i-panicked': 'dilemma:agentPanicked', 'tungsten-tycoon': 'dilemma:vendingMachine', 'blue-blazer': 'dilemma:vendingMachine:0',
    'one-word-tweet': 'dilemma:voiceLawsuit', 'no-moat': 'dilemma:rivalOpen', 'rockstar-ceo': 'policy:ceoTour:max',
    'total-recall-postponed': 'dilemma:recallFeature:0', 'elementary-writedown': 'hw:soldAtLoss', 'womens-chess-club': 'pitfall:biasedScreener',
    'secret-language': 'situation:aiPanic', 'black-box-biotech': 'pitfall:theranos', 'quick-exit': 'cancel:consumerApp',
    'room-emptied': 'valuation:crash', 'all-you-need': 'policy:publish:max', 'half-trillion-monday': 'policy:openWeights:max',
    'glazed': 'dilemma:sycophancy:1', 'eighty-seven-point-five': 'cap:50', 'breaking-fake-news': 'dilemma:fakeHeadline',
    'signatory': 'dilemma:boardRevolt:1:win', 'time-barred': 'dilemma:pit:copyrightReckoning:1:win', 'ach-extremely-hardcore': 'practice:hardcore',
    'stable-infra': 'dilemma:pit:hugOfDeath:0', 'brilliant-jerk': 'hire:jerk', 'keeper-test-failed': 'practice:keeperTest',
    'the-offer': 'practice:payToQuit', 'raise-the-bar': 'practice:barRaiser', 'nine-figure-hire': 'hire:legend',
    'greyballed': 'dilemma:greyball:0', 'toe-stepper': 'culture:superpumped', 'delete-us': 'dilemma:pit:theBlogPost:1:lose',
    'every-three-hours': 'hw:failures', 'harder-than-drugs': 'deal:duringShortage', 'one-twenty-two-days': 'policy:datacenters:max',
    'ouroboros': 'deal:circular', 'ach-chief-revenue-destroyer': 'hw:obsolete', 'paid-to-garden': 'people:seniorLeft',
    'it-looks-like': 'policy:agents:max',
}

TRIGGERS3 = {
    'openai-first-super-bowl-intelligence-age': ('campaign:superBowl', 'rare'),
    'anthropic-super-bowl-ads-not-to-claude': ('campaign:superBowl:best', 'rare'),
    'altman-calls-anthropic-ads-dishonest': ('campaign:superBowl:best', 'rare'),
    'openai-codex-super-bowl-just-build-things': ('campaign:superBowl', 'rare'),
    'google-dear-sydney-pulled': ('campaign:aiAd:worst', 'rare'),
    'artisan-stop-hiring-humans': ('campaign:billboards', 'rare'),
    'friend-subway-campaign-vandalized': ('campaign:subway:worst', 'rare'),
    'chatgpt-low-key-research-preview': ('dilemma:modelLaunch:0:win', 'legendary'),
    'altman-her-tweet-sky-voice': ('policy:ceoTour', 'rare'),
    'apple-1984-macintosh': ('campaign:superBowl:best', 'rare'),
    'apple-think-different': ('policy:marketing:max', 'rare'),
    'apple-intelligence-available-now-nad': ('policy:marketing', 'rare'),
    'apple-siri-delay-lawsuit': ('dilemma:recallFeature:0', 'rare'),
    'apple-crush-ad-apology': ('campaign:stunt:worst', 'rare'),
    'microsoft-365-copilot-app-rename': ('policy:marketing', 'rare'),
    'clippy-office-assistant': ('policy:agents:max', 'rare'),
    'nadella-made-them-dance': ('situation:frontierLeader', 'rare'),
    'google-io-ai-121-times': ('dilemma:modelLaunch:1', 'rare'),
    'gemini-hands-on-video-staged': ('dilemma:modelLaunch:1:lose', 'rare'),
    'meta-celebrity-ai-personas': ('policy:creators', 'rare'),
    'devin-first-ai-software-engineer': ('policy:coding:max', 'rare'),
    'llama4-lmarena-experimental': ('dilemma:modelLaunch:3', 'rare'),
    'gpt5-mega-chart-screwup': ('dilemma:modelLaunch:3', 'rare'),
    'ghibli-gpus-melting': ('pitfall:hugOfDeath', 'rare'),
    'sora-app-invite-only': ('campaign:waitlist', 'rare'),
    'superhuman-waitlist': ('dilemma:modelLaunch:2', 'rare'),
    'clubhouse-invite-only-peak': ('campaign:waitlist:worst', 'rare'),
    'slack-preview-8000': ('campaign:waitlist:best', 'rare'),
    'dropbox-referral-program': ('campaign:referral', 'rare'),
    'hotmail-ps-i-love-you': ('campaign:referral:best', 'rare'),
    'tesla-zero-advertising': ('policy:ceoTour:max', 'rare'),
    'old-spice-man-your-man': ('campaign:stunt:best', 'rare'),
    'dotcom-super-bowl-2000': ('campaign:superBowl:broke', 'legendary'),
    'coca-cola-ai-holiday-ad': ('campaign:aiAd', 'rare'),
    'toys-r-us-sora-ad': ('campaign:aiAd:worst', 'rare'),
}
SKIP3 = {'bing-sydney-roose', 'google-bard-jwst-error'}  # duplicates of round-one cards
ACH3 = {
    'dawn-of-the-dots': 'campaign:superBowl', 'a-time-and-a-place': 'campaign:superBowl:best', 'feeding-the-troll': 'campaign:superBowl:worst',
    'low-key': 'dilemma:modelLaunch:0:win', 'hundred-billion-dollar-typo': 'dilemma:modelLaunch:1:lose', 'ai-ai-ai': 'dilemma:modelLaunch:1',
    'latency-reduced': 'pitfall:demoDisaster', 'experimental-variant': 'dilemma:modelLaunch:3', 'chart-crime': 'policy:benchmarks:max',
    'gpus-melting': 'pitfall:hugOfDeath', 'picture-of-the-billboard': 'campaign:subway:worst', 'we-missed-the-mark': 'campaign:aiAd:worst',
    'ps-i-love-you': 'campaign:referral', 'sock-puppet': 'campaign:superBowl:broke',
}

TRIGGERS4 = {
    'blitzscaling_definition': ('stage:village', 'rare'), 'blitzscaling_embrace_chaos': ('stage:city', 'rare'),
    'blitzscaling_let_fires_burn': ('fires:3', 'rare'), 'hoffman_embarrassed': ('dilemma:modelLaunch:0', 'rare'),
    'hoffman_cliff_airplane': ('start', 'rare'), 'pg_startup_equals_growth': ('growth:5pct', 'rare'),
    'pg_make_something_people_want': ('users:10', 'rare'), 'pg_ramen_profitable': ('ramen', 'rare'),
    'pg_founder_mode': ('stage:city', 'rare'), 'andreessen_only_thing_that_matters': ('situation:gpuCrunch', 'rare'),
    'superhuman_pmf_engine': ('pmf', 'rare'), 'sean_ellis_growth_hacker': ('policy:community', 'rare'),
    'airbnb_craigslist': ('policy:scraping:max', 'rare'), 'facebook_7_friends': ('growth:10pct', 'rare'),
    'yc_founding': ('start:upstarts', 'rare'), 'altman_yc_openai': ('start:idealists', 'rare'),
    'sacks_burn_multiple': ('burn:bad', 'rare'), 'sequoia_adapting_to_endure': ('world:marketCrash', 'rare'),
    'fast_collapse': ('ending:bankrupt', 'rare'), 'convoy_collapse': ('bridge', 'rare'),
}
SKIP4 = {'pg_do_things_that_dont_scale', 'pg_default_alive'}  # duplicates of round-one cards
ACH4 = {
    'ach_embarrassed': 'dilemma:modelLaunch:0', 'ach_ten_percent': 'growth:10pct', 'ach_ramen': 'ramen',
    'ach_default_alive': 'defaultAlive', 'ach_forty_percent': 'pmf', 'ach_nation': 'stage:nation', 'ach_let_it_burn': 'fires:3',
}

KEEP = ['id', 'year', 'date', 'title', 'quote', 'speaker', 'paraphrase', 'summary', 'lesson', 'tone', 'category', 'source']


def main():
    items = json.loads(SRC.read_text())
    ids = {a['id'] for a in items}
    missing = sorted(set(TRIGGERS) - ids)
    assert not missing, f'mapping references unknown ids: {missing}'
    out = []
    for a in items:
        trig, rarity = TRIGGERS.get(a['id'], (None, 'common'))
        rec = {k: a.get(k) for k in KEEP}
        rec['trigger'] = trig if trig is not None else 'epigraph'
        rec['rarity'] = rarity
        out.append(rec)
    r2 = json.loads(SRC2.read_text())
    ids2 = {a['id'] for a in r2['artifacts']}
    missing2 = sorted(set(TRIGGERS2) - ids2)
    assert not missing2, f'round-2 mapping references unknown ids: {missing2}'
    for a in r2['artifacts']:
        if a['id'] in SKIP2:
            continue
        assert a['id'] not in ids, f'duplicate artifact id {a["id"]}'
        trig, rarity = TRIGGERS2.get(a['id'], (None, 'common'))
        rec = {k: a.get(k) for k in KEEP}
        rec['trigger'] = trig if trig is not None else 'epigraph'
        rec['rarity'] = rarity
        out.append(rec)

    r3 = json.loads(SRC3.read_text())
    all_ids = {r['id'] for r in out}
    missing4 = sorted(set(TRIGGERS3) - {a['id'] for a in r3['artifacts']})
    assert not missing4, f'marketing mapping references unknown ids: {missing4}'
    for a in r3['artifacts']:
        if a['id'] in SKIP3:
            continue
        assert a['id'] not in all_ids, f'duplicate artifact id {a["id"]}'
        trig, rarity = TRIGGERS3.get(a['id'], (None, 'common'))
        rec = {k: a.get(k) for k in KEEP}
        rec['trigger'] = trig if trig is not None else 'epigraph'
        rec['rarity'] = rarity
        out.append(rec)

    r4 = json.loads(SRC4.read_text())
    all_ids = {r['id'] for r in out}
    missing5 = sorted(set(TRIGGERS4) - {a['id'] for a in r4['artifacts']})
    assert not missing5, f'growth mapping references unknown ids: {missing5}'
    for a in r4['artifacts']:
        if a['id'] in SKIP4:
            continue
        aid = a['id'].replace('_', '-')
        assert aid not in all_ids, f'duplicate artifact id {aid}'
        trig, rarity = TRIGGERS4.get(a['id'], (None, 'common'))
        rec = {k: a.get(k) for k in KEEP}
        rec['id'] = aid
        rec['trigger'] = trig if trig is not None else 'epigraph'
        rec['rarity'] = rarity
        out.append(rec)

    ach_src = {a['id']: a for a in r2['achievements']}
    ach_src.update({a['id']: a for a in r3['achievements']})
    ach_src.update({a['id']: a for a in r4['achievements']})
    ACH.update(ACH3)
    ACH.update(ACH4)
    missing3 = sorted(set(ACH) - set(ach_src))
    assert not missing3, f'achievement mapping references unknown ids: {missing3}'
    achs = []
    for aid, trig in ACH.items():
        a = ach_src[aid]
        achs.append({'id': ('ach-' + aid if not aid.startswith('ach') else aid).replace('_', '-'), 'name': a['name'], 'trigger': trig,
                     'desc': a['basis'], 'source': a.get('source')})
    OUT_ACH.write_text(
        '/* data/achievements.js — GENERATED by tools/build_archive.py from tools/research/research_round2.json.\n'
        ' * Cheeky achievements based on real events; desc states the real-world basis. Do not edit by hand. */\n'
        "(function (FL) {\n  'use strict';\n  FL.ACHIEVEMENTS.push(\n" +
        ',\n'.join('    ' + json.dumps(a, ensure_ascii=False) for a in achs) + '\n  );\n})(globalThis.FL = globalThis.FL || {});\n'
    )
    print(f'wrote {len(achs)} achievements to {OUT_ACH.relative_to(ROOT)}')

    body = ',\n'.join('    ' + json.dumps(r, ensure_ascii=False) for r in out)
    OUT.write_text(
        '/* data/archive.js — GENERATED by tools/build_archive.py from tools/research/artifacts_research.json.\n'
        ' * Verified historical artifacts. trigger = in-game event key that unlocks it (see systems.js);\n'
        " * 'epigraph' items are commons that turn up in quarterly reports. Do not edit by hand. */\n"
        "(function (FL) {\n  'use strict';\n  FL.ARCHIVE = [\n" + body + '\n  ];\n})(globalThis.FL = globalThis.FL || {});\n'
    )
    counts = {}
    for r in out:
        counts[r['rarity']] = counts.get(r['rarity'], 0) + 1
    print(f'wrote {len(out)} artifacts to {OUT.relative_to(ROOT)}: {counts}')


if __name__ == '__main__':
    main()

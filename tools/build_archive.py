"""Build js/data/archive.js from the verified research JSON plus in-game trigger mapping.

Usage: python3 tools/build_archive.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'research' / 'artifacts_research.json'
OUT = ROOT / 'js' / 'data' / 'archive.js'

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

# build_ecocrop.py
# Turns the FAO EcoCrop table (shipped inside the CRAN package "Recocrop", file inst/parameters/ecocrop.rds)
# into a small JSON file for the Farming Suitability page: public/crops/ecocrop.json
#
# Run:  pip install pyreadr
#       python data-tools/build_ecocrop.py path/to/Recocrop/inst/parameters/ecocrop.rds
#
# Only a chosen list of farm crops is kept. The numbers are copied as they are in the table (FAO expert opinion).
import json
import sys
from pathlib import Path

import pyreadr

SOURCE = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "public" / "crops" / "ecocrop.json"

# id, EcoCrop NAME, first letters of the scientific name (to tell apart crops with the same name),
# English name, Bengali name, group
CROPS = [
    ("rice", "Rice, paddy (Indica)", None, "Rice", "ধান", "cereal"),
    ("wheat", "Wheat, common", None, "Wheat", "গম", "cereal"),
    ("maize", "Maize", "Zea mays L. s. mays", "Maize", "ভুট্টা", "cereal"),
    ("barley", "Barley", "Hordeum vulgare", "Barley", "যব", "cereal"),
    ("sorghum", "Sorghum (low altitude)", None, "Sorghum", "জোয়ার", "cereal"),
    ("pearlmillet", "Pearl millet", None, "Pearl millet", "বাজরা", "cereal"),
    ("fingermillet", "Finger millet", None, "Finger millet", "রাগি (মাণ্ডুয়া)", "cereal"),
    ("lentil", "Lentil", None, "Lentil", "মসুর", "pulse"),
    ("chickpea", "Chick pea", None, "Chickpea", "ছোলা", "pulse"),
    ("mungbean", "Mung bean", None, "Mung bean", "মুগ", "pulse"),
    ("urd", "Urd bean", None, "Black gram (urd)", "মাষকলাই", "pulse"),
    ("pigeonpea", "Pigeon Pea", None, "Pigeon pea", "অড়হর", "pulse"),
    ("pea", "Pea", None, "Pea", "মটর", "pulse"),
    ("cowpea", "Cowpea", None, "Cowpea", "বরবটি", "pulse"),
    ("grasspea", "Grass pea *", None, "Grass pea (khesari)", "খেসারি", "pulse"),
    ("hyacinth", "Hyacinth bean", None, "Hyacinth bean", "শিম", "pulse"),
    ("soybean", "Soyabean", None, "Soybean", "সয়াবিন", "pulse"),
    ("groundnut", "Groundnut", None, "Groundnut", "চিনাবাদাম", "oilseed"),
    ("sesame", "Sesame seed", None, "Sesame", "তিল", "oilseed"),
    ("sunflower", "Sunflower", None, "Sunflower", "সূর্যমুখী", "oilseed"),
    ("mustard", "Bird rape", None, "Mustard / rape", "সরিষা", "oilseed"),
    ("safflower", "Safflower", None, "Safflower", "কুসুম", "oilseed"),
    ("linseed", "Linseed", None, "Linseed", "তিসি", "oilseed"),
    ("castor", "Castor", None, "Castor", "রেড়ি", "oilseed"),
    ("potato", "Potato", "Solanum tuberosum", "Potato", "আলু", "vegetable"),
    ("tomato", "Tomato", None, "Tomato", "টমেটো", "vegetable"),
    ("eggplant", "Eggplant", "Solanum melongena", "Brinjal (eggplant)", "বেগুন", "vegetable"),
    ("cabbage", "Cabbage", None, "Cabbage", "বাঁধাকপি", "vegetable"),
    ("cauliflower", "Cauliflower", None, "Cauliflower", "ফুলকপি", "vegetable"),
    ("onion", "Onion", None, "Onion", "পেঁয়াজ", "vegetable"),
    ("garlic", "Garlic", None, "Garlic", "রসুন", "vegetable"),
    ("okra", "Okra, lady fingers", None, "Okra", "ঢেঁড়স", "vegetable"),
    ("carrot", "Carrot", None, "Carrot", "গাজর", "vegetable"),
    ("radish", "Radish, Western", None, "Radish", "মুলা", "vegetable"),
    ("spinach", "Spinach", None, "Spinach", "পালংশাক", "vegetable"),
    ("cucumber", "Cucumber", None, "Cucumber", "শসা", "vegetable"),
    ("pumpkin", "Pumpkin", None, "Pumpkin", "মিষ্টিকুমড়া", "vegetable"),
    ("bittergourd", "Bitter gourd *", None, "Bitter gourd", "করলা", "vegetable"),
    ("bottlegourd", "Bottle gourd *", None, "Bottle gourd", "লাউ", "vegetable"),
    ("ridgedgourd", "Ridged gourd *", None, "Ridged gourd", "ঝিঙা", "vegetable"),
    ("snakegourd", "Snake gourd *", None, "Snake gourd", "চিচিঙ্গা", "vegetable"),
    ("waxgourd", "Wax gourd *", None, "Wax gourd", "চালকুমড়া", "vegetable"),
    ("sweetpepper", "Sweet pepper", None, "Sweet pepper (capsicum)", "ক্যাপসিকাম", "vegetable"),
    ("chilli", "Hot pepper", None, "Chilli", "মরিচ", "vegetable"),
    ("ceylonspinach", "Ceylon spinach", None, "Indian spinach (pui)", "পুঁইশাক", "vegetable"),
    ("coriander", "Coriander *", None, "Coriander", "ধনিয়া", "vegetable"),
    ("sweetpotato", "Sweet potato", None, "Sweet potato", "মিষ্টি আলু", "root"),
    ("cassava", "Cassava", None, "Cassava", "কাসাভা", "root"),
    ("ginger", "Ginger", None, "Ginger", "আদা", "root"),
    ("turmeric", "Tumeric *", None, "Turmeric", "হলুদ", "root"),
    ("banana", "Banana", "Musa acuminata Colla", "Banana", "কলা", "fruit"),
    ("mango", "Mango", None, "Mango", "আম", "fruit"),
    ("papaya", "Papaya", None, "Papaya", "পেঁপে", "fruit"),
    ("guava", "Guava", None, "Guava", "পেয়ারা", "fruit"),
    ("lychee", "Lychee", None, "Lychee", "লিচু", "fruit"),
    ("jackfruit", "Jackfruit", None, "Jackfruit", "কাঁঠাল", "fruit"),
    ("pineapple", "Pineapple", None, "Pineapple", "আনারস", "fruit"),
    ("lemon", "Lemon", None, "Lemon", "লেবু", "fruit"),
    ("orange", "Sweet orange", None, "Sweet orange", "কমলা", "fruit"),
    ("watermelon", "Watermelon", None, "Watermelon", "তরমুজ", "fruit"),
    ("muskmelon", "Musk melon", None, "Melon", "খরমুজ", "fruit"),
    ("coconut", "Coconut", None, "Coconut", "নারকেল", "fruit"),
    ("whitejute", "White Jute", None, "White jute", "সাদা পাট", "fibre"),
    ("tossajute", "Long-fruited Jute", None, "Tossa jute", "তোষা পাট", "fibre"),
    ("cotton", "Cotton, American upland", None, "Cotton", "তুলা", "fibre"),
    ("sugarcane", "Sugarcane", "Saccharum officinarum", "Sugarcane", "আখ", "cash"),
    ("tea", "Tea", "Camellia sinensis (L)", "Tea", "চা", "cash"),
]


def num(value):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return int(v) if v == int(v) else v


def codes(value):
    # "M H" -> ["M", "H"]; "W" means any
    return [c.upper() for c in str(value).split() if c.strip()]


table = list(pyreadr.read_r(str(SOURCE)).values())[0]
out = []
for cid, name, sci, en, bn, group in CROPS:
    rows = table[table["NAME"].str.strip() == name]
    if sci:
        rows = rows[rows["SCIENTNAME"].str.startswith(sci)]
    if rows.empty:
        raise SystemExit(f"Not found in EcoCrop: {name} {sci}")
    r = rows.iloc[0]
    out.append({
        "id": cid, "en": en, "bn": bn, "group": group,
        "ecocrop": str(r["NAME"]).strip(), "sci": str(r["SCIENTNAME"]).strip(), "family": str(r["FAMNAME"]).strip(),
        "gmin": num(r["GMIN"]), "gmax": num(r["GMAX"]),
        "t": [num(r["TMIN"]), num(r["TOPMN"]), num(r["TOPMX"]), num(r["TMAX"])],
        "r": [num(r["RMIN"]), num(r["ROPMN"]), num(r["ROPMX"]), num(r["RMAX"])],
        "ph": [num(r["PHMIN"]), num(r["PHOPMN"]), num(r["PHOPMX"]), num(r["PHMAX"])],
        "text": codes(r["TEXT"]), "textr": codes(r["TEXTR"]),
        "dra": codes(r["DRA"]), "drar": codes(r["DRAR"]),
        "ktmp": num(r["KTMP"]),
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    "source": "FAO EcoCrop database, as shipped in the CRAN package Recocrop 0.4-2 (R. J. Hijmans)",
    "note": "Expert-opinion ranges, not necessarily optimal. t = air temperature (min, optimum low, optimum high, max, °C); r = rainfall during the growing cycle (mm); ph = soil pH; text = soil texture (L light, M medium, H heavy, O organic, W any); dra = drainage (W well, I impeded, E excessive, P poor).",
    "crops": out,
}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(out), "crops ->", OUT)

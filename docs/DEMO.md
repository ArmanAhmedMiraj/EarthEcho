# EarthEcho: demo script (about 8 minutes; for 5 minutes use sections 0, 1, 4b and 7)

Use a phone or a narrow browser window for the opening, then the laptop for the rest. Have one field saved beforehand ("Rice Field", Rangpur or Dhaka area) and a second one ("Vegetable Garden") for switching.

## 0. The one-line pitch (15 s)
"A farmer saves their field once. EarthEcho reads NASA data for that exact place and tells them what to plant, when to water, and what danger is coming, in Bengali, without an account."

## 1. Open on My Farm (45 s)
- Open the live link. The app opens straight on **My Farm** with the last field. No login.
- Point at the blue **EarthEcho estimate** tags (soil, height, slope) and the green **You entered** tags. "We never mix what the satellite thinks with what the farmer knows."
- Change the soil with "I know my soil". Show that the original estimate stays visible.

## 2. Add details, the farmer's way (30 s)
- **My details**: land size in **bigha**, crop now, crop next, irrigation. Everything is optional and saves as you type.
- "More details is folded away so nobody is overwhelmed."

## 3. Switch field, everything follows (30 s)
- Tap **Vegetable Garden** in the banner. Every tab now shows that field.
- Show **Add a field** and **Move this field**.

## 4. What the data says (60 s)
- **Suitability**: the "Your field" box rates their own crops. Explain the score: set by whatever holds the crop back most (FAO EcoCrop).
- **Rotation planner**: rotations that include their next crop come first, with profit workings.
- **Irrigation**: the crop and land size came from My Farm, with no retyping. Show the next irrigation date and litres.
- **Disaster watch**: earthquakes, alerts and river level for the field.
- **Market prices**: nearest markets, in Bengali.

## 4b. The Field Shift story: compare strategies (2 min)
This is the main demo for the challenge. Open **Rotation planner** with the Rice field (current crop Rice, before it Mustard).
- **Comparison table**: "Your current rotation" next to three alternatives, with fit, months in use, bare months, legume, crop families, water gap and profit. Say the current rotation uses assumed sowing months (the page says so).
- **Priorities**: tap *Save water* and *Soil health*. The alternatives change and each card starts with a line about your choice.
- **What-if**: pick *Dry year* or *Hot and dry*. The numbers line shows the effect and which of the farmer's crops suffer.
- **One strategy card** (open it): the five parts, why it was suggested, evidence, benefits, **information gaps** and risks.
- **NASA evidence** (scroll): 25-year temperature and rain history, the 12-month field calendar (grey = bare, droplet = bare in heavy rain) and the erosion-risk rating. Mention the rainfall jump around 2016 that the app refuses to call a trend.
- **How sure are we?** in each card: what was measured, assumed or missing, and how to be more sure.
- **Explain this strategy with the assistant**: one tap, the assistant explains it in five parts, in Bengali if the app is in Bengali.
- Close with: "It never says switch crops. It shows the evidence, the gaps and the risks, and the farmer decides."

## 4c. Seeing the data itself (60 s)
- **Weather**, *Is this season normal?*: this week and next week against NASA's normal for the time of year, and the range of past years for each month.
- **Environment**, *NASA map layers*: choose Greenness, Land temperature or Soil moisture, move the time slider or press Play, and read the value at the field. Press the history button for a small chart.
- **Data** tab, *Learn*: the "satellite or ground" explainer (one satellite pixel next to a one-hectare field) and the glossary, in Bengali too.

## 5. Ask EarthEcho (45 s)
- Switch the language to Bengali. Ask: "আমার জমিতে এখন কোন ফসল ভালো হবে?"
- Show the answer in Bengali with **[S1] source badges**. "It answers only from the farm data and a sourced knowledge base, and says when it does not know."

## 6. Works on a phone, offline (30 s)
- Show it installed on the home screen. Turn on airplane mode and reopen. It still shows the last data.
- "No account, nothing leaves the phone except coordinates."

## 7. Close (15 s)
"Free, bilingual, no login, NASA data, and honest about its limits."

## Questions judges may ask

- **Where does the soil come from?** ISRIC SoilGrids, a 250 m satellite-based model. It is an estimate, labelled as one, and the farmer can override it.
- **How accurate is crop suitability?** It is the FAO EcoCrop method with NASA climate averages. It says where to look first, not what to plant.
- **Where is the data stored?** On the farmer's phone. No server holds accounts.
- **What if the data service is slow?** Each page handles missing data and says so. The climate answer is never held up by slow satellite pictures.
- **Why no login?** Farmers who are not used to apps should not need one. The backup file moves fields to another phone.
- **What is AI used for?** Only the assistant and the "Explain this strategy" button. Everything else is data and published methods, shown in the Data tab.
- **Is the strategy comparison a yield forecast?** No. It is rule-based: crop fit to the place, bare months, legumes, crop families, water gap, heat and cold months. It gives no yield or income forecast.
- **Why do the alternatives show 100% fit?** In irrigated mode rain is not counted. The table has a second row, the fit on rain alone, so the farmer sees both.
- **How do you handle uncertainty?** Every strategy lists what is measured, assumed or missing and gives a plain rating (fairly, somewhat, not very sure). The NASA evidence panel also refuses to claim a rainfall trend where the series has a sudden jump.
- **How does this support, not replace, the farmer?** The farmer's own crops and priorities drive the comparison, every card has an information-gaps section, and each answer ends with "check with your local agriculture officer".
- **Are the data licences checked?** Yes, on the Data tab. Two are still flagged honestly: the FAO EcoCrop page's own user agreement and the Esri basemap's current terms.
- **What leaves the phone?** Coordinates go to the data services. Questions to the assistant go to an AI provider with the place, crops and field notes. Farmers are told not to write personal details in notes.

## Before you demo (checklist)

- [ ] Open the live link once with internet, so it works offline later.
- [ ] Two fields are saved.
- [ ] `GROQ_API_KEY` is set on Vercel, and the assistant answers.
- [ ] Language switch works (English and Bengali).
- [ ] Rotation planner shows the comparison table, NASA evidence and "Explain this strategy" (needs `GROQ_API_KEY` or `GEMINI_API_KEY`).
- [ ] Environment tab shows the NASA map and the value at the field (needs internet).
- [ ] Open every tab once online so it also works offline.
- [ ] Phone is charged and the screen will not lock.

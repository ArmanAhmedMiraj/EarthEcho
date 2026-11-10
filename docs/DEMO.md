# EarthEcho: demo script (about 5 minutes)

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

## 4. What the data says (90 s)
- **Suitability**: the "Your field" box rates their own crops. Explain the score: set by whatever holds the crop back most (FAO EcoCrop).
- **Rotation planner**: rotations that include their next crop come first, with profit workings.
- **Irrigation**: the crop and land size came from My Farm, with no retyping. Show the next irrigation date and litres.
- **Disaster watch**: earthquakes, alerts and river level for the field.
- **Market prices**: nearest markets, in Bengali.

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
- **What is AI used for?** Only the assistant. Everything else is data and published methods, shown in the Data tab.

## Before you demo (checklist)

- [ ] Open the live link once with internet, so it works offline later.
- [ ] Two fields are saved.
- [ ] `GROQ_API_KEY` is set on Vercel, and the assistant answers.
- [ ] Language switch works (English and Bengali).
- [ ] Phone is charged and the screen will not lock.

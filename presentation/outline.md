# ISKA outline

## intro

- Wie heeft al eens een model lokaal gerunt
- LM studio ? oLLama?
- andere?

vandaag kijken hoe je een "state-of-the-art" model runt?

Hoe gaan we dat doen ? 

Code natuurlijk!

wat gaan we niet doen?

- GPU / CUDA / ONNX
- Dingen installeren op de dure toasters
  
Wat gaan we wel doen?

- CPU based in inference runner in "csharp"
- Toy versie -> (nog geen echte modellen da kan menne laptop nie aan)

## First round of questioning
- wie heeft er al eens van een dot product gehoord?
- Wie weet er hoe matrix multiplicatie gebeurd?

Voorbeelden geven en duidelijk maken. cuz thats going to be half the battle to understand.


## Most basic inference archtiecture

To start:
1 "layer"
(pre) RMSNorm
Singe head self attention
Causal gating

Trust me bro dit gaat al half de talk worden wss

Demo tokenizer

Uitleg over QKV

## Positional embedding

## Swiglu (as an example of activation features)


## To round off
- how the fuck do you find out these things?
- Getting a sense of the scale of things.

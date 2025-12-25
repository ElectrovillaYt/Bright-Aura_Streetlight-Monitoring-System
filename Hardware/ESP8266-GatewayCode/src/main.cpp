// This is the code for Gateway receievig data from the nodes and formtting it and feeding it into recieved geojson if data is changed
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>

#define StatusbuffSize 3

// ============ WiFi Credentials =============
const char *SSID = "WiFi SSID";
const char *PASSWORD = "WiFi Password";

const char *DeviceName = "ESP-Gateway 01";

SoftwareSerial moduleSerial(D1, D2); // Rx, Tx for LoRa Module

bool debug = false; // Enable/Disable debug mode

// ============ LoRaWAN Credentials =============
#define NetworkId "1"        // LoRaWAN Network ID (should match with nodes)
#define addr "1"             // LoRaWAN Address of Gateway (Self)
#define RXaddr "2"           // LoRaWAN Address of Node to receive data from (Streetlight-nodes)
#define loraBand "865000000" // LoRaWAN Band 865MHz
#define LoraCPIN "00028161"  // LoRaWAN PIN for the domain

// ============== Server Credentials =============
const char *ServerUrl = "url-to-backend-server"; // server url (Express js)
const char *key = "1230";                        // Auth Key for authentication should match with server key (default -> 1230)

//============== Location Details=============
const char *Country = "Country";     // Country Name
const char *State = "State"; // State Name
const char *Place = "City/Place";    // Place/City Name

const int ledPin = LED_BUILTIN;

long long stateIdx = 0;
char statusBuff[StatusbuffSize] = {0};
int GetResCode = 0;
size_t currentIndex = 0;
JsonDocument jsonDoc;

void LEDStatus(short int times, int delayMs)
{
  for (int i = 0; i < times; i++)
  {
    digitalWrite(ledPin, LOW);
    delay(delayMs);
    digitalWrite(ledPin, HIGH);
    delay(delayMs);
  }
}

void SendACK()
{
  char ackRes[10];
  snprintf(ackRes, sizeof(ackRes), "+ACK=1");

  int ackLen = strlen(ackRes);

  char command[64];
  snprintf(command, sizeof(command), "AT+SEND=%s,%d,%s", RXaddr, ackLen, ackRes);
  moduleSerial.println(command);
  moduleSerial.flush();
  if (debug)
  {
    Serial.println(command);
  }
}

void getLoraData()
{
  if (moduleSerial.available())
  {

    String res = moduleSerial.readString();
    if (!res.startsWith("+RCV=") || res.length() < 1)
    {
      return;
    }
    int firstComma = res.indexOf(',');
    int secondComma = res.indexOf(',', firstComma + 1);
    int thirdComma = res.indexOf(',', secondComma + 1);
    if (firstComma == -1 || secondComma == -1 || thirdComma == -1)
    {
      return;
    }

    SendACK();
    String rawData = res.substring(secondComma + 1, thirdComma);
    int index = 0;
    for (char c : rawData)
    {
      if (c != '|' && index < StatusbuffSize) // Buffer owerflow protection (exceptional)
      {
        statusBuff[index++] = c;
      }
    }
  }
}

// Process data- process json and add data from buffer to json
bool ProcessData()
{
  if (statusBuff[0] == '\0')
  {
    return false;
  }
  // Count number of elements in buffer
  int StatusbuffIDX = 0;
  for (int i = 0; i < StatusbuffSize; i++)
  {
    if (statusBuff[i] != '\0')
    {
      StatusbuffIDX++;
    }
  }

  JsonObject root = jsonDoc.as<JsonObject>();
  JsonArray featuresArray = root["features"].as<JsonArray>();
  size_t featuresArraySize = featuresArray.size();

  if (currentIndex >= featuresArraySize)
  {
    currentIndex = 0;
  }

  int assignedCount = 0;
  if (featuresArraySize > 1 && StatusbuffIDX > 1)
  {
    for (; currentIndex < featuresArraySize && assignedCount < 3; currentIndex++, assignedCount++)
    {
      JsonObject feature = featuresArray[currentIndex];
      JsonObject properties = feature["properties"];
      char tempStr[2] = {statusBuff[currentIndex % StatusbuffIDX], '\0'};
      properties["status"] = tempStr; // Assign value from the buffer
    }
  }
  else
  {
    if (debug)
    {
      Serial.println("Only one node exists!");
    }
    JsonObject feature = featuresArray[currentIndex];
    JsonObject properties = feature["properties"];
    char tempStr[2] = {statusBuff[0], '\0'};
    properties["status"] = tempStr; // Assign first value from the buffer
  }
  return true;
}

// Handle Get Req- get the json from server
bool HandleGetReq()
{
  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  HTTPClient https;

  client->setInsecure(); // Bypass SSL

  // Begin the HTTPS request
  if (!https.begin(*client, strcat(ServerUrl, "/data")))
  {
    if (debug)
    {
      Serial.println("Failed to connect to server");
    }
    return false;
  }

  delay(250); // Wait briefly before sending request
  // add required adders
  char locationData[128];
  snprintf(locationData, sizeof(locationData), "{\"Country\":\"%s\",\"State\":\"%s\",\"Place\":\"%s\"}", Country, State, Place);

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Accept", "application/json");
  https.addHeader("key", key);
  https.addHeader("data", locationData);

  // Perform GET request
  GetResCode = https.GET();
  String ReceivedJSON;
  char RESPONSE[32];
  snprintf(RESPONSE, sizeof(RESPONSE), "Response=%d", GetResCode);
  if (GetResCode == 200)
  {
    if (debug)
    {
      Serial.print("GET Response Code: ");
      Serial.println(RESPONSE);
    }
    String res = https.getString();
    if (res.length() > 0)
    {
      LEDStatus(3, 50); // Blink LED 3 times with 50ms delay when dataStream is not empty!
      DeserializationError error = deserializeJson(jsonDoc, res);

      if (error) // Json Validation Check!
      {
        if (debug)
        {
          Serial.print("Deserialization failed: ");
          Serial.println(error.c_str());
        }
        https.end();
        return false;
      }
      https.end();
      return true;
    }
    else
    {
      if (debug)
      {
        Serial.print("GET request failed with code: ");
        Serial.println(RESPONSE);
      }
      https.end();
      return false;
    }
    return false;
  }
  else
  {
    if (debug)
    {
      Serial.print("Error during GET request: ");
      Serial.println(RESPONSE);
    }
    https.end();
    return false;
  }
}

// Handle Psot Req- Post JSON to server
void HandlePostREQ()
{
  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  HTTPClient https;

  client->setInsecure(); // Bypass SSL

  // Begin new connection for POST request
  while (!https.begin(*client, strcat(ServerUrl, "/data")))
  {
    Serial.println("Failed to connect for POST request");
    delay(100);
  }

  // Perform POST request if GET was successful and FinalData is not empty
  if (GetResCode == 200 && !jsonDoc.isNull())
  {
    String PostData;
    serializeJson(jsonDoc, PostData);

    // Set required headers for POST request
    https.addHeader("Content-Type", "application/json");
    https.addHeader("Accept", "application/json");
    https.addHeader("key", key);
    char locationData[128];

    snprintf(locationData, sizeof(locationData), "{\"Country\":\"%s\",\"State\":\"%s\",\"Place\":\"%s\"}", Country, State, Place);
    https.addHeader("data", locationData);

    // Perform POST request
    int POSTResponseCode = https.POST(PostData);

    if (POSTResponseCode > 0)
    {
      String response = https.getString();
      if (debug)
      {
        Serial.println("POST Response: " + response);
      }

      if (POSTResponseCode == 200)
      {
        LEDStatus(1, 100);
        if (debug)
          Serial.println("POST successful");
      }
      else if (POSTResponseCode == 202 && debug)
      {
        Serial.println("Waiting for new data...");
      }
      else if (debug)
      {
        Serial.print("POST request failed: ");
        Serial.println(response + ' ' + "Response: " + POSTResponseCode);
      }
    }
    else if (debug)
    {
      Serial.print("Error in POST request: ");
      Serial.println(POSTResponseCode);
    }
  }
  else
  {
    if (debug)
    {
      Serial.println("Skipping POST request! Retrying Get req...");
    }
    jsonDoc.clear();
    https.end(); // Close the connection
    return;
  }
}

void setup()
{
  Serial.begin(115200);
  moduleSerial.begin(115200);

  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, HIGH);
  WiFi.mode(WIFI_STA);
  WiFi.hostname(DeviceName);
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
  }
  Serial.println("\nConnected to Wifi!");
  // Configure LoRa Module
  const char *cmdArray[2][5] = {{"AT+RESET", "AT+BAND", "AT+ADDRESS", "AT+NETWORKID", "AT+CPIN"}, {"\0", loraBand, addr, NetworkId, LoraCPIN}};
  char command[32]; // Size depends on max command length

  for (int i = 0; i < 5; i++)
  {
    snprintf(command, sizeof(command), i == 0 ? "%s%s" : "%s=%s", cmdArray[0][i], cmdArray[1][i]);
    moduleSerial.println(command);
    if (debug)
    {
      Serial.println(command);
      delay(500);
      Serial.println(moduleSerial.available() ? ("\tResponse: " + moduleSerial.readString()) : "No Response!");
    }
    delay(300);
  }
}

void loop()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    digitalWrite(ledPin, 1);
    getLoraData();
    if (statusBuff[0] != '\0')
    {
      while (!HandleGetReq())
      {
        delay(500); // Retry Get Request
      }
      if (ProcessData())
      {
        HandlePostREQ(); // Handle Post Request
      }
      else
      {
        if (debug)
        {
          Serial.println("No data received from chain Skipping Post Request!");
        }
      }
    }
    jsonDoc.clear(); // Clear JSON
    delay(1000);     // Timer of 1 Second
  }
  else
  {
    digitalWrite(ledPin, 0);
    if (debug)
    {
      Serial.println("Wifi not connected!");
      jsonDoc.clear();
    }
    if (WiFi.reconnect())
    {
      return;
    };
  }
}

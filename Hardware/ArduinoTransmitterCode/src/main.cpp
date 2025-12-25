// Arduino (chain node) code

#include <Arduino.h>
#include <SoftwareSerial.h>

// LoRa Module Configuration
#define networkID "1"
#define loraBand "865000000"
#define loraCPIN "00028161"
#define moduleAddr "2" // Address of this node

bool debug = true; // Enable debug serial output

#define voltSense A0
#define sunSense A1

SoftwareSerial moduleSerial(8, 9); // Rx, Tx for LoRa module

#define debugSerial Serial
#define txBuffSize 3

char state = '0'; // Default faulty state
char txBuff[txBuffSize];
int txBuffIdx = 0;


unsigned long lastSerialCheck = 0;
const unsigned long serialWaitTimeout = 2000; // timeout in ms
bool serialWaiting = false;

void LEDStatus(short int times, int delayMs, bool debugMode = debug)
{
  if (debugMode)
  {
    for (int i = 0; i < times; i++)
    {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(delayMs);
      digitalWrite(LED_BUILTIN, LOW);
      delay(delayMs);
    }
  }
}

// Get current state from sensors and convert to char
char getCurrentState()
{
  float volt = analogRead(voltSense) * 5.0 / 1023.0;
  int sunIntensity = analogRead(sunSense);

  if (volt >= 4.2 && sunIntensity > 512)
  {
    return '1'; // Working
  }
  else if (volt < 4.2 && sunIntensity > 512)
  {
    return '0'; // Faulty
  }
  else
  {
    return '2'; // Day Time
  }
}

// Append message to tx buffer
bool appendToTxBuff(const String &message)
{
  if (txBuffIdx >= txBuffSize)
  {
    return false;
  }
  else
  {
    for (char c : message)
    {
      if (c != '|')
      {
        txBuff[txBuffIdx++] = c;
      }
    }
    return true;
  }
}

// Send +ACK=xxx response to prev node!
void SendACK(long int len, int txAddr)
{
  char ackRes[32];
  snprintf(ackRes, sizeof(ackRes), "+ACK=%ld", len);

  int ackLen = strlen(ackRes);

  char command[64];
  snprintf(command, sizeof(command), "AT+SEND=%d,%d,%s", txAddr, ackLen, ackRes);
  moduleSerial.println(command);
  moduleSerial.flush();
  if (debug)
  {
    debugSerial.println(command);
  }
}

// Read a line from the module serial
String readSerialLine(bool raw = false)
{
  if (moduleSerial.available())
  {
    String res = moduleSerial.readStringUntil('\n');
    if (!raw)
    {
      int firstComma = res.indexOf(',');
      int secondComma = res.indexOf(',', firstComma + 1);
      int thirdComma = res.indexOf(',', secondComma + 1);
      return res.substring(secondComma + 1, thirdComma);
    }
    else
    {
      return res;
    }
  }
  else
  {
    return "";
  }
}

// Send AT command and wait for response
bool moduleSerialSend(const String &s, const unsigned int responseTimeoutms = 5000)
{
  int retryCount = 0;
  bool ackReceived = false;
  String expectedACK = "+ACK=1";
  if (s.length() <= 0)
  {
    return false;
  }
  if (debug)
  {
    debugSerial.println("[SEND] " + s);
    delay(300);
    debugSerial.println(moduleSerial.available() ? ("Response: " + moduleSerial.readString()) : "No Response!");
  }
  while (moduleSerial.available())
  {
    moduleSerial.read();
  }
  moduleSerial.println(s);
  delay(15);

  unsigned long startTime = millis();
  bool gotOK = false;

  // Phase 1: Wait for +OK
  while (millis() - startTime < responseTimeoutms)
  {
    if (moduleSerial.available())
    {
      String line = readSerialLine();
      line.trim();

      if (debug)
      {
        debugSerial.println("[RECV]: " + line);
      }

      if (line == "+OK")
      {
        LEDStatus(1,100);
        gotOK = true;
        break;
      }
    }
  }

  if (!gotOK)
  {
    debugSerial.println("Timeout waiting for +OK");
    return false;
  }

  // Phase 2: Wait for ACK after OK
  else
  {
    while (retryCount < 3 && !ackReceived)
    {
      unsigned long ackWaitStart = millis();
      while (millis() - ackWaitStart < responseTimeoutms)
      {
        if (moduleSerial.available())
        {
          String response = readSerialLine();
          if (response.indexOf(expectedACK) != -1)
          {
            ackReceived = true;
            LEDStatus(3,50);
            if (debug)
            {
              Serial.println("ACK Received!");
            }
            break;
          }
        }
      }

      if (!ackReceived)
      {
        retryCount++;
        if (debug)
        {
          Serial.println("Retrying, Wating for ACK Response...");
        }
      }
    }
  }
  if (!ackReceived && debug)
  {
    debugSerial.println("Timeout waiting for +ACK");
  }
  return ackReceived;
}

// Transmit data through LoRa
bool moduleLoRaTransmit(const String &data)
{
  long dataSize = data.length();
  String command = "AT+SEND=" + String(atoi(moduleAddr) - 1) + "," + String(dataSize) + "," + data;
  if (debug)
  {
    debugSerial.println("[TX DATA] " + data);
  }
  return moduleSerialSend(command);
}

// Parse received +RCV string
String parseRCVString(const String &s)
{
  int firstComma = s.indexOf(',');
  int secondComma = s.indexOf(',', firstComma + 1);
  int thirdComma = s.indexOf(',', secondComma + 1);
  return s.substring(secondComma + 1, thirdComma);
}

// Parse Address of transmitter node in chain (N-1)
int parseRXAddr(const String &s)
{
  int addrIndex = s.indexOf(',');
  return s.substring(5, addrIndex).toInt();
}

// Parse RX buffer, extract message, append sensor data, send ACK, buffer message
void parseRxBuff()
{
  if (moduleSerial.available())
  {
    String msg = readSerialLine(true);
    if (msg.startsWith("+RCV="))
    {
      if (debug)
      {
        debugSerial.println("[RCV]: " + msg);
      }
      int RXaddr = parseRXAddr(msg);
      String rcvData = parseRCVString(msg);
      SendACK(rcvData.length(), RXaddr);
      appendToTxBuff(rcvData);
    }
    serialWaiting = false;
    lastSerialCheck = millis();
  }
  else
  {
    if (!serialWaiting)
    {
      // Start the waiting period
      lastSerialCheck = millis();
      serialWaiting = true;
    }

    // If no data received for the timeout duration
    if (millis() - lastSerialCheck > serialWaitTimeout)
    {
      // First node in the chain
      char currentState = getCurrentState();

      while (!moduleLoRaTransmit(String(currentState)))
      {
        ; // wait until ACK is received
      }

      serialWaiting = false; // Reset for next loop
    }
  }
}

// Transmit all buffered messages
bool transmitTxBuff()
{
  String currMsg = "";
  for (int i = 0; i < txBuffIdx; i++)
  {
    currMsg += txBuff[i];
    if (i < (txBuffIdx - 1))
    {
      currMsg += '|';
    }
  }
  if (currMsg != "")
  {
    bool status = moduleLoRaTransmit(currMsg);
    if (status)
    {
      for (int i = 0; i < txBuffIdx; i++)
      {
        txBuff[i] = '\0';
      }
      txBuffIdx = 0;
      return true;
    }
    else
    {
      return false;
    }
  }
  return false;
}

void setup()
{
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(voltSense, INPUT);
  pinMode(sunSense, INPUT);
  debugSerial.begin(115200);
  moduleSerial.begin(115200);

  const char *cmdArray[2][5] = {{"AT+RESET", "AT+BAND", "AT+ADDRESS", "AT+NETWORKID", "AT+CPIN"}, {"\0", loraBand, moduleAddr, networkID, loraCPIN}};
  char command[32]; // Size depends on max command length

  for (int i = 0; i < 5; i++)
  {
    snprintf(command, sizeof(command), i == 0 ? "%s%s" : "%s=%s", cmdArray[0][i], cmdArray[1][i]);
    moduleSerial.println(command);
    if (debug)
    {
      Serial.println(command);
      delay(500);
      debugSerial.println(moduleSerial.available() ? ("\tResponse: " + moduleSerial.readString()) : "No Response!");
    }
    delay(300);
  }
}

void loop()
{
  parseRxBuff();
  bool res = transmitTxBuff();
  if (res)
  {
    moduleLoRaTransmit(String(getCurrentState()));
  }
  delay(2000); // Wait before repeating
}
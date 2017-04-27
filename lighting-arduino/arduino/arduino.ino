#include <Adafruit_DotStar.h>
#include <SPI.h> 

#define BAUD_RATE 9600

#define NUM_LEDS   17 // Number of LEDs in a strip
#define NUM_STRIPS 4 // Number of strips

// Note: Do not use PIN 0 and PIN 1 as clock or data
// pin. This will not work as they interfere with the
// serial connection!
uint8_t PIN_DATA[] = {A5,A4,A3,A2,A1,A0};
uint8_t PIN_CLOCK[]  = {2,3,4,5,6,7};

uint8_t STRIP_REORDERING[] = {0,1,2,3,4,5};

Adafruit_DotStar* strip[NUM_STRIPS];

void setup() {

  for(uint8_t i = 0; i < NUM_STRIPS; ++i) {
    uint8_t s = STRIP_REORDERING[i];
    strip[i] = new Adafruit_DotStar(NUM_LEDS, PIN_DATA[s], PIN_CLOCK[s], DOTSTAR_BRG);
    strip[i]->begin();
  }
	
  all_strips_off();
  show_power_up_sequence();

  Serial.begin(BAUD_RATE);
  
	while (!Serial) {
		; // wait for serial port to connect. Needed for native USB port only
	}
}

void all_strips_off() {
  for(uint16_t i = 0; i < NUM_STRIPS; ++i) {
      set_all(i, 0);
  }
}

void show_power_up_sequence() {
  for(uint16_t i = 0; i < NUM_STRIPS; ++i) {

      for(uint16_t j = 0; j < NUM_LEDS; ++j) {
        strip[i]->setPixelColor(j, 0xFFFFFF);
        strip[i]->show();
        delay(100);
        strip[i]->setPixelColor(j, 0);
      }

      set_all(i, 0xFFFFFF);
      delay(1000);
      set_all(i, 0);
  }
}

// expected 3 byte datagram:
// +--------+--------------------+
// | LED id |     brightness     |
// +--------+--------------------+
// whereas LED id is 1 byte
// and brightness is 3 byte between 0 and 0xFFFFFF
uint8_t datagram[4];

// 0, 1, 2 or 3
// 0 if zero bytes of the datagram were recieved.
// 1 if 1st byte, the LED id was recieved.
// 2 if 2nd byte, the red channel was recieved.
// 3 if 3rd byte, the green channel was recieved.
// 4 if 4th byte, the blue channel was recieved.
int state;

void loop(){

	if (Serial.available()) {
		*(datagram+state) = Serial.read();
		++state;

		if(state == 4) {
			state = 0;

			uint32_t brightness = datagram[1];
			brightness <<= 8;
			brightness |= datagram[2];
			brightness <<= 8;
			brightness |= datagram[3];

			uint16_t strip = datagram[0] / (NUM_LEDS+1);
			uint16_t led_in_strip = datagram[0] % (NUM_LEDS+1);

			if(strip > NUM_STRIPS) {
				ACK_FAIL();
				return;
			}
      
			if(led_in_strip == NUM_LEDS) {
				set_all(strip, brightness);
			} else {
				set_led(strip, led_in_strip, brightness);
			}

			ACK(datagram);
		}
	}
}

void set_led(uint16_t strip_id, uint16_t led_in_strip, uint32_t brightness) {
 	strip[strip_id]->setPixelColor(led_in_strip, brightness);
	strip[strip_id]->show();
}

void set_all(uint16_t strip_id, uint32_t brightness) {
 	for(uint16_t i = 0; i < NUM_LEDS; ++i) {
		strip[strip_id]->setPixelColor(i, brightness);
	}

	strip[strip_id]->show();
}

void ACK_FAIL() {}

void ACK(uint8_t* datagram) {
	Serial.write(datagram[0]);
	Serial.write(datagram[1]);
	Serial.write(datagram[2]);
	Serial.write(datagram[3]);
}

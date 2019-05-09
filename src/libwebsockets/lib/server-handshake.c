/*
 * libwebsockets - small server side websockets and web server implementation
 *
 * Copyright (C) 2010-2013 Andy Green <andy@warmcat.com>
 *
 *  This library is free software; you can redistribute it and/or
 *  modify it under the terms of the GNU Lesser General Public
 *  License as published by the Free Software Foundation:
 *  version 2.1 of the License.
 *
 *  This library is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public
 *  License along with this library; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 *  MA  02110-1301  USA
 */

#include "private-libwebsockets.h"

#include "md5\md5.h"
#include "md5\md5_loc.h"
#include "math.h"

#define LWS_CPYAPP(ptr, str) { strcpy(ptr, str); ptr += strlen(str); }

/*
 * Perform the newer BASE64-encoded handshake scheme
 */

int
handshake_0405(struct libwebsocket_context *context, struct libwebsocket *wsi)
{
	unsigned char hash[20];
	int n;
	char *response;
	char *p;
	int accept_len;
#ifndef LWS_NO_EXTENSIONS
	char *c;
	char ext_name[128];
	struct libwebsocket_extension *ext;
	int ext_count = 0;
	int more = 1;
#endif

	if (!lws_hdr_total_length(wsi, WSI_TOKEN_HOST) ||
				!lws_hdr_total_length(wsi, WSI_TOKEN_KEY)) {
		lwsl_parser("handshake_04 missing pieces\n");
		/* completed header processing, but missing some bits */
		goto bail;
	}

	if (lws_hdr_total_length(wsi, WSI_TOKEN_KEY) >=
						     MAX_WEBSOCKET_04_KEY_LEN) {
		lwsl_warn("Client key too long %d\n", MAX_WEBSOCKET_04_KEY_LEN);
		goto bail;
	}

	/*
	 * since key length is restricted above (currently 128), cannot
	 * overflow
	 */
	n = sprintf((char *)context->service_buffer,
				"%s258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
				lws_hdr_simple_ptr(wsi, WSI_TOKEN_KEY));

	SHA1(context->service_buffer, n, hash);

	accept_len = lws_b64_encode_string((char *)hash, 20,
			(char *)context->service_buffer,
			sizeof(context->service_buffer));
	if (accept_len < 0) {
		lwsl_warn("Base64 encoded hash too long\n");
		goto bail;
	}

	/* allocate the per-connection user memory (if any) */
	if (libwebsocket_ensure_user_space(wsi))
		goto bail;

	/* create the response packet */

	/* make a buffer big enough for everything */

	response = (char *)context->service_buffer + MAX_WEBSOCKET_04_KEY_LEN;
	p = response;
	LWS_CPYAPP(p, "HTTP/1.1 101 Switching Protocols\x0d\x0a"
		      "Upgrade: WebSocket\x0d\x0a"
		      "Connection: Upgrade\x0d\x0a"
		      "Sec-WebSocket-Accept: ");
	strcpy(p, (char *)context->service_buffer);
	p += accept_len;

	if (lws_hdr_total_length(wsi, WSI_TOKEN_PROTOCOL)) {
		LWS_CPYAPP(p, "\x0d\x0aSec-WebSocket-Protocol: ");
		n = lws_hdr_copy(wsi, p, 128, WSI_TOKEN_PROTOCOL);
		if (n < 0)
			goto bail;
		p += n;
	}

#ifndef LWS_NO_EXTENSIONS
	/*
	 * Figure out which extensions the client has that we want to
	 * enable on this connection, and give him back the list
	 */

	if (lws_hdr_total_length(wsi, WSI_TOKEN_EXTENSIONS)) {

		/*
		 * break down the list of client extensions
		 * and go through them
		 */

		if (lws_hdr_copy(wsi, (char *)context->service_buffer,
				sizeof(context->service_buffer),
						      WSI_TOKEN_EXTENSIONS) < 0)
			goto bail;

		c = (char *)context->service_buffer;
		lwsl_parser("WSI_TOKEN_EXTENSIONS = '%s'\n", c);
		wsi->count_active_extensions = 0;
		n = 0;
		while (more) {

			if (*c && (*c != ',' && *c != ' ' && *c != '\t')) {
				ext_name[n] = *c++;
				if (n < sizeof(ext_name) - 1)
					n++;
				continue;
			}
			ext_name[n] = '\0';
			if (!*c)
				more = 0;
			else {
				c++;
				if (!n)
					continue;
			}

			/* check a client's extension against our support */

			ext = wsi->protocol->owning_server->extensions;

			while (ext && ext->callback) {

				if (strcmp(ext_name, ext->name)) {
					ext++;
					continue;
				}

				/*
				 * oh, we do support this one he
				 * asked for... but let's ask user
				 * code if it's OK to apply it on this
				 * particular connection + protocol
				 */

				n = wsi->protocol->owning_server->
					protocols[0].callback(
						wsi->protocol->owning_server,
						wsi,
					  LWS_CALLBACK_CONFIRM_EXTENSION_OKAY,
						  wsi->user_space, ext_name, 0);

				/*
				 * zero return from callback means
				 * go ahead and allow the extension,
				 * it's what we get if the callback is
				 * unhandled
				 */

				if (n) {
					ext++;
					continue;
				}

				/* apply it */

				if (ext_count)
					*p++ = ',';
				else
					LWS_CPYAPP(p,
					 "\x0d\x0aSec-WebSocket-Extensions: ");
				p += sprintf(p, "%s", ext_name);
				ext_count++;

				/* instantiate the extension on this conn */

				wsi->active_extensions_user[
					wsi->count_active_extensions] =
					     malloc(ext->per_session_data_size);
				if (wsi->active_extensions_user[
				     wsi->count_active_extensions] == NULL) {
					lwsl_err("Out of mem\n");
					free(response);
					goto bail;
				}
				memset(wsi->active_extensions_user[
					wsi->count_active_extensions], 0,
						    ext->per_session_data_size);

				wsi->active_extensions[
					  wsi->count_active_extensions] = ext;

				/* allow him to construct his context */

				ext->callback(wsi->protocol->owning_server,
						ext, wsi,
						LWS_EXT_CALLBACK_CONSTRUCT,
						wsi->active_extensions_user[
					wsi->count_active_extensions], NULL, 0);

				wsi->count_active_extensions++;
				lwsl_parser("count_active_extensions <- %d\n",
						  wsi->count_active_extensions);

				ext++;
			}

			n = 0;
		}
	}
#endif
	/* end of response packet */

	LWS_CPYAPP(p, "\x0d\x0a\x0d\x0a");
	
	if (!lws_any_extension_handled(context, wsi,
			LWS_EXT_CALLBACK_HANDSHAKE_REPLY_TX,
						     response, p - response)) {

		/* okay send the handshake response accepting the connection */

		lwsl_parser("issuing resp pkt %d len\n", (int)(p - response));
	#ifdef DEBUG
		fwrite(response, 1,  p - response, stderr);
	#endif
		n = libwebsocket_write(wsi, (unsigned char *)response,
						  p - response, LWS_WRITE_HTTP);
		if (n != (p - response)) {
			lwsl_debug("handshake_0405: ERROR writing to socket\n");
			goto bail;
		}

	}

	/* alright clean up and set ourselves into established state */

	wsi->state = WSI_STATE_ESTABLISHED;
	wsi->lws_rx_parse_state = LWS_RXPS_NEW;

	/* notify user code that we're ready to roll */

	if (wsi->protocol->callback)
		wsi->protocol->callback(wsi->protocol->owning_server,
				wsi, LWS_CALLBACK_ESTABLISHED,
					  wsi->user_space, NULL, 0);

	return 0;


bail:
	/* free up his parsing allocations */

	if (wsi->u.hdr.ah)
		free(wsi->u.hdr.ah);

	return -1;
}


int interpret_key(const char *key, unsigned long *result)
{
	char digits[20];
	int digit_pos = 0;
	const char *p = key;
	unsigned int spaces = 0;
	unsigned long acc = 0;
	int rem = 0;

	while (*p) {
		if (isdigit(*p)) {
			if (digit_pos == sizeof(digits)-1)
				return -1;
			digits[digit_pos++] = *p;
		}
		p++;
	}
	digits[digit_pos] = '\0';
	if (!digit_pos)
		return -2;

	while (*key) {
		if (*key == ' ')
			spaces++;
		key++;
	}

	if (!spaces)
		return -3;

	p = &digits[0];
	while (*p) {
		rem = (rem * 10) + ((*p++) - '0');
		acc = (acc * 10) + (rem / spaces);
		rem -= (rem / spaces) * spaces;
	}

	if (rem) {
		fprintf(stderr, "nonzero handshake remainder\n");
		return -1;
	}

	*result = acc;

	return 0;
}




/**	MD5		**/

long long longParse(char *str)
{
	long long result = 0;
	for (int i = 0; i < (int)strlen(str); i++)
	{
		unsigned digit = str[strlen(str) - 1 - i] - '0';
		result += (long long)(digit * pow((double)10, i));
	}
	return result;
}

char* createMD5Buffer(int result1, int result2, char challenge[8])
{
	char* raw_answer = (char*)calloc(MD5_SIZE, sizeof(char));
	raw_answer[0] = ((unsigned char*)&result1)[3];
	raw_answer[1] = ((unsigned char*)&result1)[2];
	raw_answer[2] = ((unsigned char*)&result1)[1];
	raw_answer[3] = ((unsigned char*)&result1)[0];
	raw_answer[4] = ((unsigned char*)&result2)[3];
	raw_answer[5] = ((unsigned char*)&result2)[2];
	raw_answer[6] = ((unsigned char*)&result2)[1];
	raw_answer[7] = ((unsigned char*)&result2)[0];
	for (int i = 0; i < 8; i++)
	{
		raw_answer[8 + i] = challenge[i];
	}
	//display: (debugging)
	/*printf("raw answser bytes: ");
	for (int i = 0; i < MD5_SIZE; i++)
	printf(" %d", (unsigned char)raw_answer[i]);
	printf("\n\n");*/
	return raw_answer;
}

char* createHash(const char *key1, const char *key2, char *challenge)
{
	assert(key1 != NULL);
	assert(key2 != NULL);
	assert(challenge != NULL);

	int spaces1 = 0;
	int spaces2 = 0;
	char* digits1 = (char*)calloc(64, sizeof(char));
	char *digits2 = (char*)calloc(64, sizeof(char));
	int d1 = 0, d2 = 0;
	//string digits1, digits2;
	int result1, result2;
	for (int i = 0; i < (int)strlen(key1); i++)
	{
		if (key1[i] == 0x20)
			spaces1++;
	}
	for (int i = 0; i < (int)strlen(key2); i++)
	{
		if (key2[i] == 0x20)
			spaces2++;
	}

	for (int i = 0; i < (int)strlen(key1); i++)
	{
		if (isdigit(key1[i]))
		{
			digits1[d1++] = key1[i];
		}
	}
	for (int i = 0; i < (int)strlen(key2); i++)
	{
		if (isdigit(key2[i]))
		{
			digits2[d2++] = key2[i];
		}
	}

    // From hixie ws protocol-76:
    //"Finally, _dividing_ by this number of spaces is intended to
    // make sure that even the most naive of implementations will check for
    // spaces, since if ther server does not verify that there are some
    // spaces, the server will try to divide by zero, which is usually fatal
    // (a correct handshake will always have at least one space)."
    //
    // So, if no spaces, handshake is invalid, ignore.
    //
    if (spaces1 == 0 || spaces2 == 0)
    {
        return NULL;
    }

	result1 = (int)(longParse(digits1) / spaces1);
	result2 = (int)(longParse(digits2) / spaces2);

	char* raw_answer = createMD5Buffer(result1, result2, challenge);

	/* calculate the sig */
	char * sig = (char*)calloc(MD5_SIZE, sizeof(char));

	md5_buffer(raw_answer, MD5_SIZE, sig);	//sig is the MD5 hash

	//debug
	/*for (int i = 0; i < MD5_SIZE; i++)
	{
	printf("%d %d\n", raw_answer[i], (unsigned char)sig[i]);
	}*/
	/* convert from the sig to a string rep */
	//char* str = (char*)calloc(64, sizeof(char));    
	//md5_sig_to_string(sig, str, sizeof(str));

	return sig;
}




int handshake_00(struct libwebsocket *wsi)
{
//	unsigned long key1, key2;
//	unsigned char sum[16];
	char *response = NULL;
	char *p;
	char *pEnd;
	int responseLen;
	int n;

	/* Confirm we have all the necessary pieces */

	if (lws_hdr_total_length(wsi, WSI_TOKEN_KEY) >=
		MAX_WEBSOCKET_04_KEY_LEN) {
		lwsl_warn("Client key too long %d\n", MAX_WEBSOCKET_04_KEY_LEN);
        fprintf(stderr, "server-handshake: failed, client key too long.\n");
		goto bail;
	}


	if (!lws_hdr_total_length(wsi, WSI_TOKEN_ORIGIN) ||
		!lws_hdr_total_length(wsi, WSI_TOKEN_HOST) ||
		!lws_hdr_total_length(wsi, WSI_TOKEN_CHALLENGE) ||
		!lws_hdr_total_length(wsi, WSI_TOKEN_KEY1) ||
		!lws_hdr_total_length(wsi, WSI_TOKEN_KEY2))
	{
		/* completed header processing, but missing some bits */
        fprintf(stderr, "server-handshake: failed, missing parts of header.\n");
		goto bail;
	}

	/* allocate the per-connection user memory (if any) */

	if (wsi->protocol->per_session_data_size) {
		wsi->user_space = malloc(
			wsi->protocol->per_session_data_size);
		if (wsi->user_space == NULL) 
        {
			fprintf(stderr, "server-handshake: Out of memory for conn user space\n");
			goto bail;
		}
	}
	else
		wsi->user_space = NULL;

	/* create the response packet */

	/* make a buffer big enough for everything */

	responseLen = 256 +
		lws_hdr_total_length(wsi, WSI_TOKEN_UPGRADE) +
		lws_hdr_total_length(wsi, WSI_TOKEN_CONNECTION) +
		lws_hdr_total_length(wsi, WSI_TOKEN_HOST) +
		lws_hdr_total_length(wsi, WSI_TOKEN_ORIGIN) +
		lws_hdr_total_length(wsi, WSI_TOKEN_GET_URI) +
		lws_hdr_total_length(wsi, WSI_TOKEN_PROTOCOL);
	response = malloc(responseLen);
	if (!response) 
    {
		fprintf(stderr, "server-handshake: Out of memory for response buffer\n");
		goto bail;
	}

	p = response;
	// end of buffer, to calculate space remaining
	pEnd = p + responseLen;
	
	strcpy(p, "HTTP/1.1 101 WebSocket Protocol Handshake\x0d\x0a"
		"Upgrade: WebSocket\x0d\x0a");
	p += strlen("HTTP/1.1 101 WebSocket Protocol Handshake\x0d\x0a"
		"Upgrade: WebSocket\x0d\x0a");
	strcpy(p, "Connection: Upgrade\x0d\x0a"
		"Sec-WebSocket-Origin: ");
	p += strlen("Connection: Upgrade\x0d\x0a"
		"Sec-WebSocket-Origin: ");

	//strcpy(p, wsi->utf8_token[WSI_TOKEN_ORIGIN].token);
	//p += lws_hdr_total_length(wsi, WSI_TOKEN_ORIGIN);
	n = lws_hdr_copy(wsi, p, pEnd - p, WSI_TOKEN_ORIGIN);
	if (n < 0)
    {
        fprintf(stderr, "server-handshake: failed in lws_hdr_copy(), WSI_TOKEN_ORIGIN\n");
		goto bail;
    }
	p += n;

#ifdef LWS_OPENSSL_SUPPORT
	if (use_ssl) {
		strcpy(p, "\x0d\x0aSec-WebSocket-Location: wss://");
		p += strlen("\x0d\x0aSec-WebSocket-Location: wss://");
	}
	else {
#endif
		strcpy(p, "\x0d\x0aSec-WebSocket-Location: ws://");
		p += strlen("\x0d\x0aSec-WebSocket-Location: ws://");
#ifdef LWS_OPENSSL_SUPPORT
	}
#endif
	
	//strcpy(p, wsi->utf8_token[WSI_TOKEN_HOST].token);
	//p += lws_hdr_total_length(wsi, WSI_TOKEN_HOST);
	n = lws_hdr_copy(wsi, p, pEnd-p, WSI_TOKEN_HOST);
	if (n < 0)
    {
        fprintf(stderr, "server-handshake: failed in lws_hdr_copy(), WSI_TOKEN_HOST\n");
		goto bail;
    }
	p += n;
	
	//strcpy(p, wsi->utf8_token[WSI_TOKEN_GET_URI].token);
	//p += lws_hdr_total_length(wsi, WSI_TOKEN_GET_URI);
	n = lws_hdr_copy(wsi, p, pEnd - p, WSI_TOKEN_GET_URI);
	if (n < 0)
    {
        fprintf(stderr, "server-handshake: failed in lws_hdr_copy(), WSI_TOKEN_GET_URI\n");
		goto bail;
    }
	p += n;


	if (lws_hdr_total_length(wsi, WSI_TOKEN_PROTOCOL) > 0)
	{
		strcpy(p, "\x0d\x0aSec-WebSocket-Protocol: ");
		p += strlen("\x0d\x0aSec-WebSocket-Protocol: ");

		//strcpy(p, wsi->utf8_token[WSI_TOKEN_PROTOCOL].token);
		//p += lws_hdr_total_length(wsi, WSI_TOKEN_PROTOCOL);
		n = lws_hdr_copy(wsi, p, pEnd - p, WSI_TOKEN_PROTOCOL);
		if (n < 0)
        {
            fprintf(stderr, "server-handshake: failed in lws_hdr_copy(), WSI_TOKEN_PROTOCOL\n");
			goto bail;
        }
		p += n;
	}

	strcpy(p, "\x0d\x0a\x0d\x0a");
	p += strlen("\x0d\x0a\x0d\x0a");

    //(SW)
	// from other program
	//create handshake response:
	char* hash = createHash(
		lws_hdr_simple_ptr(wsi, WSI_TOKEN_KEY1), 
		lws_hdr_simple_ptr(wsi, WSI_TOKEN_KEY2), 
		lws_hdr_simple_ptr(wsi, WSI_TOKEN_CHALLENGE));
    // Failed to create hash, invalid keys.  
    // Do not return handshake.  Connection not established.
    //
    if (NULL == hash)
    {
        fprintf(stderr, "server-handshake: createHash failed.  No spaces in key.\n");
        goto bail;
    }        

	memcpy(p, hash, MD5_SIZE*sizeof(char));
	free(hash);

	p += MD5_SIZE;

	///* convert the two keys into 32-bit integers */

	//if (interpret_key(lws_hdr_simple_ptr(wsi, WSI_TOKEN_KEY1), &key1))
	//	goto bail;
	//if (interpret_key(lws_hdr_simple_ptr(wsi, WSI_TOKEN_KEY2), &key2))
	//	goto bail;

	///* lay them out in network byte order (MSB first */

	//sum[0] = key1 >> 24;
	//sum[1] = key1 >> 16;
	//sum[2] = key1 >> 8;
	//sum[3] = key1;
	//sum[4] = key2 >> 24;
	//sum[5] = key2 >> 16;
	//sum[6] = key2 >> 8;
	//sum[7] = key2;

	///* follow them with the challenge token we were sent */

	//memcpy(&sum[8], lws_hdr_simple_ptr(wsi, WSI_TOKEN_CHALLENGE), 8);

	///*
	//* compute the md5sum of that 16-byte series and use as our
	//* payload after our headers
	//*/

	//MD5(sum, 16, (unsigned char *)p);
	//p += 16;



	//... needed?
	if (!lws_any_extension_handled(context, wsi,
		LWS_EXT_CALLBACK_HANDSHAKE_REPLY_TX,
		response, p - response)) {

		/* it's complete: go ahead and send it */

		lwsl_parser("issuing resp pkt %d len\n", (int)(p - response));

#ifdef DEBUG
		fwrite(response, 1, p - response, stderr);
#endif



		n = libwebsocket_write(wsi, (unsigned char *)response,
			p - response, LWS_WRITE_HTTP);
		if (n < 0) 
        {
			fprintf(stderr, "ERROR writing to socket");
			goto bail;
		}
	}

	/* alright clean up and set ourselves into established state */

	free(response);
	wsi->state = WSI_STATE_ESTABLISHED;
	wsi->lws_rx_parse_state = LWS_RXPS_NEW;

	/* notify user code that we're ready to roll */

	if (wsi->protocol->callback)
	{
		wsi->protocol->callback(
			wsi->protocol->owning_server,
			wsi, LWS_CALLBACK_ESTABLISHED,
			wsi->user_space, NULL, 0);
	}

	return 0;

bail:
    free(response);
	return -1;
}








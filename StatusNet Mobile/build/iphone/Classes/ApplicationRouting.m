/**
 * Appcelerator Titanium Mobile
 * This is generated code. Do not modify. Your changes *will* be lost.
 * Generated code is Copyright (c) 2009-2010 by Appcelerator, Inc.
 * All Rights Reserved.
 */
#import <Foundation/Foundation.h>
#import "ApplicationRouting.h"

extern NSData * decode64 (NSData * thedata); 
extern NSData * dataWithHexString (NSString * hexString);
extern NSData * decodeDataWithKey (NSData * thedata, NSString * key);

@implementation ApplicationRouting

+ (NSData*) resolveAppAsset:(NSString*)path;
{
     static NSMutableDictionary *map;
     if (map==nil)
     {
         map = [[NSMutableDictionary alloc] init];
         [map setObject:dataWithHexString(@"546974616e69756d2e55492e7365744261636b67726f756e64436f6c6f7228272330303027293b7661722074616247726f75703d546974616e69756d2e55492e63726561746554616247726f757028293b7661722074616247726f7570323d6e756c6c3b7661722077696e313d546974616e69756d2e55492e63726561746557696e646f77287b7469746c653a275461622031272c6261636b67726f756e64436f6c6f723a2723666666277d293b76617220746162313d546974616e69756d2e55492e637265617465546162287b69636f6e3a274b535f6e61765f76696577732e706e67272c7469746c653a275461622031272c77696e646f773a77696e317d293b766172206c6162656c313d546974616e69756d2e55492e6372656174654c6162656c287b636f6c6f723a2723393939272c746578743a274920616d2057696e646f772031272c666f6e743a7b666f6e7453697a653a32302c666f6e7446616d696c793a2748656c766574696361204e657565277d2c74657874416c69676e3a2763656e746572272c77696474683a276175746f277d293b77696e312e616464286c6162656c31293b7661722077696e323d546974616e69756d2e55492e63726561746557696e646f77287b7469746c653a275461622032272c6261636b67726f756e64436f6c6f723a2723666666277d293b76617220746162323d546974616e69756d2e55492e637265617465546162287b69636f6e3a274b535f6e61765f75692e706e67272c7469746c653a275461622032272c77696e646f773a77696e327d293b766172206c6162656c323d546974616e69756d2e55492e6372656174654c6162656c287b636f6c6f723a2723393939272c746578743a274920616d2057696e646f772032272c666f6e743a7b666f6e7453697a653a32302c666f6e7446616d696c793a2748656c766574696361204e657565277d2c74657874416c69676e3a2763656e746572272c77696474683a276175746f277d293b77696e322e616464286c6162656c32293b74616247726f75702e6164645461622874616231293b74616247726f75702e6164645461622874616232293b74616247726f75702e6f70656e28293b") forKey:@"app_js"];
     }
     return [map objectForKey:path];
}

@end

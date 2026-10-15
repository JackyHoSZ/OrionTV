package com.oriontv.danmaku.inspect;
import android.app.Instrumentation;
import android.app.Activity;
import android.app.UiAutomation;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.InputDevice;
import android.view.KeyCharacterMap;
import android.os.Bundle;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Xml;
import java.io.StringWriter;
import org.xmlpull.v1.XmlSerializer;

/** Separate test-only process. Never restarts or modifies the foreground application. */
public class Inspector extends Instrumentation {
  private String keys;
  private String focus;
  private String text;
  private boolean compact;
  @Override public void onCreate(Bundle arguments) { super.onCreate(arguments);keys=arguments.getString("keys");focus=arguments.getString("focus");text=arguments.getString("text");compact="1".equals(arguments.getString("compact"));start(); }
  @Override public void onStart() {
    Bundle result=new Bundle();
    try {
      UiAutomation automation=getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
      if(focus!=null){
        AccessibilityNodeInfo root=root(automation);
        AccessibilityNodeInfo target=find(root,focus);
        if(target==null)throw new IllegalStateException("TARGET_NOT_FOUND");
        if(text==null){
          while(!target.isFocusable()&&target.getParent()!=null)target=target.getParent();
          target.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.getId());
        }
        target.refresh();
        if(text!=null){Bundle arguments=new Bundle();arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,text);
          if(!target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,arguments))throw new IllegalStateException("TEXT_REFUSED");
          finish(Activity.RESULT_OK,result);return;
        }
        if(!target.isFocused()&&!target.performAction(AccessibilityNodeInfo.ACTION_FOCUS))throw new IllegalStateException("FOCUS_REFUSED");
        SystemClock.sleep(300);
      }
      if(keys!=null){
        for(String value:keys.split(",")){
          int key=Integer.parseInt(value);long t=SystemClock.uptimeMillis();
          automation.injectInputEvent(new KeyEvent(t,t,KeyEvent.ACTION_DOWN,key,0,0,KeyCharacterMap.VIRTUAL_KEYBOARD,0,KeyEvent.FLAG_FROM_SYSTEM,InputDevice.SOURCE_DPAD),true);
          SystemClock.sleep(80);
          automation.injectInputEvent(new KeyEvent(t,SystemClock.uptimeMillis(),KeyEvent.ACTION_UP,key,0,0,KeyCharacterMap.VIRTUAL_KEYBOARD,0,KeyEvent.FLAG_FROM_SYSTEM,InputDevice.SOURCE_DPAD),true);
          SystemClock.sleep(800);
        }
        result.putString("keys",keys);finish(Activity.RESULT_OK,result);return;
      }
      AccessibilityNodeInfo root=root(automation);
      StringWriter file=new StringWriter();
      XmlSerializer xml=Xml.newSerializer();xml.setOutput(file);xml.startDocument("UTF-8",true);
      xml.startTag(null,"hierarchy");
      if(compact){
        for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByText("PROBE loaded=")){if(node.getContentDescription()!=null&&node.getContentDescription().toString().startsWith("PROBE "))write(xml,node,0);}
        for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByText("DANMAKU_STATUS "))write(xml,node,0);
        AccessibilityNodeInfo focused=root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);if(focused!=null)write(xml,focused,0);
      }else write(xml,root,0);
      xml.endTag(null,"hierarchy");xml.endDocument();root.recycle();
      result.putString("xml",file.toString());finish(Activity.RESULT_OK,result);
    }catch(Exception e){result.putString("error",e instanceof IllegalStateException?e.getMessage():e.getClass().getSimpleName());finish(Activity.RESULT_CANCELED,result);}
  }
  private AccessibilityNodeInfo root(UiAutomation automation){
    AccessibilityNodeInfo root=automation.getRootInActiveWindow();
    for(int i=0;i<30&&root==null;i++){SystemClock.sleep(100);root=automation.getRootInActiveWindow();}
    if(root==null)throw new IllegalStateException("NO_ACCESSIBILITY_ROOT");return root;
  }
  private AccessibilityNodeInfo find(AccessibilityNodeInfo node,String label){
    if(node==null)return null;
    for(AccessibilityNodeInfo candidate:node.findAccessibilityNodeInfosByText(label))if(label.contentEquals(candidate.getContentDescription()==null?"":candidate.getContentDescription()))return candidate;
    return findDeep(node,label);
  }
  private AccessibilityNodeInfo findDeep(AccessibilityNodeInfo node,String label){
    if(node==null)return null;
    if(label.contentEquals(node.getContentDescription()==null?"":node.getContentDescription())||label.contentEquals(node.getText()==null?"":node.getText()))return node;
    if(node.getClassName()!=null&&node.getClassName().toString().startsWith("com.horcrux.svg"))return null;
    for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo result=findDeep(node.getChild(i),label);if(result!=null)return result;}
    return null;
  }
  private void write(XmlSerializer xml,AccessibilityNodeInfo node,int depth)throws Exception {
    if(depth>60)return;
    CharSequence label=node.getContentDescription();
    if(label!=null&&(label.toString().startsWith("PROBE ")||label.toString().startsWith("DANMAKU_STATUS ")||label.toString().equals("danmaku-panel-status")))node.refresh();
    xml.startTag(null,"node");
    xml.attribute(null,"text",node.getText()==null?"":node.getText().toString());
    xml.attribute(null,"content-desc",node.getContentDescription()==null?"":node.getContentDescription().toString());
    xml.attribute(null,"class",node.getClassName()==null?"":node.getClassName().toString());
    xml.attribute(null,"focused",Boolean.toString(node.isFocused()));
    Rect r=new Rect();node.getBoundsInScreen(r);xml.attribute(null,"bounds","["+r.left+","+r.top+"]["+r.right+","+r.bottom+"]");
    if(node.getClassName()==null||!node.getClassName().toString().startsWith("com.horcrux.svg"))
      for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null){write(xml,child,depth+1);child.recycle();}}
    xml.endTag(null,"node");
  }
}
